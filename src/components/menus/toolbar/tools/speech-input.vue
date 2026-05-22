<template>
  <menus-button
    ico="microphone"
    :text="buttonText"
    hide-text
    :menu-active="recording"
    :disabled="!supported || transcribing"
    @menu-click="toggleSpeechInput"
  />
</template>

<script setup>
import { transcribeEditorVoice } from '@/api/backend-ai'
import { MessagePlugin } from '@/composables/dialog'

const editor = inject('editor')

const AudioContextCtor =
  typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
const supported =
  typeof window !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  Boolean(AudioContextCtor)
const recording = ref(false)
const transcribing = ref(false)
const mediaStream = shallowRef(null)
const audioContext = shallowRef(null)
const audioProcessor = shallowRef(null)
const recordChunks = shallowRef([])
const recordSampleRate = ref(16000)
const buttonText = computed(() => {
  if (!supported) return t('tools.speechInput.unsupported')
  if (recording.value) return t('tools.speechInput.stop')
  return transcribing.value ? '语音识别中' : t('tools.speechInput.start')
})

const mergeFloat32Chunks = (chunks) => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const merged = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

const downsamplePcm = (input, inputSampleRate, outputSampleRate) => {
  if (outputSampleRate >= inputSampleRate) return input
  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j += 1) sum += input[j]
    output[i] = sum / Math.max(1, end - start)
  }
  return output
}

const encodeWav16k = (chunks, inputSampleRate) => {
  const samples = downsamplePcm(mergeFloat32Chunks(chunks), inputSampleRate, 16000)
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 16000 * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }
  return new Blob([view], { type: 'audio/wav' })
}

const cleanupRecorder = async () => {
  audioProcessor.value?.disconnect()
  audioProcessor.value = null
  mediaStream.value?.getTracks().forEach((track) => track.stop())
  mediaStream.value = null
  const context = audioContext.value
  audioContext.value = null
  if (context) await context.close().catch(() => undefined)
}

const insertSpeechText = (text) => {
  const value = String(text || '').trim()
  if (!value || editor.value?.isEditable === false) return
  if (runVoiceCommand(value)) return
  editor.value?.chain().focus().insertContent(value).run()
}

const normalizeCommandText = (text) => String(text || '').replace(/[，。！？、,.!?；;\s]/g, '').trim()

const runVoiceCommand = (text) => {
  const value = normalizeCommandText(text)
  const chain = () => editor.value?.chain().focus()
  const commands = {
    撤销: () => editor.value?.commands.undo(),
    重做: () => editor.value?.commands.redo(),
    换行: () => chain()?.setHardBreak().run(),
    加粗: () => chain()?.toggleBold().run(),
    取消加粗: () => chain()?.toggleBold().run(),
    斜体: () => chain()?.toggleItalic().run(),
    下划线: () => chain()?.toggleUnderline().run(),
    删除线: () => chain()?.toggleStrike().run(),
    标题一: () => chain()?.toggleHeading({ level: 1 }).run(),
    一级标题: () => chain()?.toggleHeading({ level: 1 }).run(),
    标题二: () => chain()?.toggleHeading({ level: 2 }).run(),
    二级标题: () => chain()?.toggleHeading({ level: 2 }).run(),
    标题三: () => chain()?.toggleHeading({ level: 3 }).run(),
    三级标题: () => chain()?.toggleHeading({ level: 3 }).run(),
    正文: () => chain()?.setParagraph().run(),
    居左: () => chain()?.setTextAlign('left').run(),
    居中: () => chain()?.setTextAlign('center').run(),
    居右: () => chain()?.setTextAlign('right').run(),
    两端对齐: () => chain()?.setTextAlign('justify').run(),
    无序列表: () => chain()?.toggleBulletList().run(),
    项目列表: () => chain()?.toggleBulletList().run(),
    有序列表: () => chain()?.toggleOrderedList().run(),
    编号列表: () => chain()?.toggleOrderedList().run(),
    待办列表: () => chain()?.toggleTaskList().run(),
    引用: () => chain()?.toggleBlockquote().run(),
    代码: () => chain()?.toggleCode().run(),
    选中全部: () => chain()?.selectAll().run(),
    全选: () => chain()?.selectAll().run(),
  }
  const action = commands[value]
  if (!action) return false
  action()
  return true
}

const startRecording = async () => {
  if (!supported) {
    MessagePlugin.warning(t('tools.speechInput.unsupported'))
    return
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const context = new AudioContextCtor()
  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)
  recordChunks.value = []
  recordSampleRate.value = context.sampleRate
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0)
    recordChunks.value.push(new Float32Array(input))
    event.outputBuffer.getChannelData(0).fill(0)
  }
  source.connect(processor)
  processor.connect(context.destination)
  mediaStream.value = stream
  audioContext.value = context
  audioProcessor.value = processor
  recording.value = true
}

const stopRecording = async () => {
  recording.value = false
  transcribing.value = true
  try {
    const chunks = recordChunks.value
    await cleanupRecorder()
    if (!chunks.length) throw new Error('未采集到有效音频')
    const text = await transcribeEditorVoice(encodeWav16k(chunks, recordSampleRate.value))
    insertSpeechText(text)
  } finally {
    transcribing.value = false
  }
}

const toggleSpeechInput = async () => {
  try {
    if (recording.value) {
      await stopRecording()
      return
    }
    await startRecording()
  } catch (error) {
    recording.value = false
    transcribing.value = false
    await cleanupRecorder()
    const message = error?.name === 'NotAllowedError' ? t('tools.speechInput.permissionDenied') : error?.message || t('tools.speechInput.failed')
    MessagePlugin.error(message)
  }
}

onBeforeUnmount(() => {
  void cleanupRecorder()
})
</script>
