// Ambient study sounds synthesised with Web Audio, so no audio files ship with the app.

export type AmbientKind = 'rain' | 'brown'

let ctx: AudioContext | null = null
let stopCurrent: (() => void) | null = null

function noiseBuffer(ac: AudioContext, brown: boolean): AudioBuffer {
  const len = ac.sampleRate * 4
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      } else {
        data[i] = white
      }
    }
  }
  return buf
}

export function playAmbient(kind: AmbientKind, volume = 0.4): void {
  stopAmbient()
  ctx ??= new AudioContext()
  const ac = ctx
  void ac.resume()
  const master = ac.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(volume, ac.currentTime + 1.5)
  master.connect(ac.destination)

  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, kind === 'brown')
  src.loop = true
  const nodes: AudioNode[] = [src]

  if (kind === 'rain') {
    // Steady hiss shaped like distant rain, plus slow swells.
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 400
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2800
    const swell = ac.createGain()
    swell.gain.value = 0.25
    const lfo = ac.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = ac.createGain()
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain).connect(swell.gain)
    lfo.start()
    src.connect(hp).connect(lp).connect(swell).connect(master)
    nodes.push(hp, lp, swell, lfo, lfoGain)
  } else {
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    src.connect(lp).connect(master)
    nodes.push(lp)
  }
  src.start()

  stopCurrent = () => {
    const t = ac.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + 0.6)
    setTimeout(() => {
      for (const n of nodes) {
        if (n instanceof AudioScheduledSourceNode) n.stop()
        n.disconnect()
      }
      master.disconnect()
    }, 700)
  }
}

export function stopAmbient(): void {
  stopCurrent?.()
  stopCurrent = null
}
