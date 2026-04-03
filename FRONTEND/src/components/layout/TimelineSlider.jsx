import React, { useMemo } from 'react'
import { useTimeMachine } from '../../contexts/TimeMachineContext.jsx'
import { motion } from 'motion/react'
import { Button } from '../ui/button.jsx'
import { Slider } from '../ui/slider.jsx'

export default function TimelineSlider() {
  const {
    minTime,
    maxTime,
    simulatedTime,
    setSimulatedTime,
    isPlaying,
    setIsPlaying,
  } = useTimeMachine()

  const span = Math.max(1, maxTime - minTime)
  const step = useMemo(
    () => Math.max(1, Math.min(60_000, Math.floor(span / 500))),
    [span],
  )

  const sliderMin = minTime
  const sliderMax = maxTime <= minTime ? minTime + 1 : maxTime
  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, simulatedTime))

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-4xl">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.2 }}
        className="backdrop-blur-xl bg-bg-overlay/90 border border-edge rounded-2xl shadow-2xl px-6 py-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="iconLg"
              variant="default"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => setIsPlaying(!isPlaying)}
              className="hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </Button>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Simulated Time</span>
              <span className="text-sm font-mono font-bold text-amber">
                {new Date(simulatedTime).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="text-right text-xs text-text-muted flex flex-col">
            <span>Now:</span>
            <span className="font-mono">{new Date(maxTime).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="relative flex min-h-6 w-full items-center pt-1">
          <Slider
            min={sliderMin}
            max={sliderMax}
            step={step}
            value={[sliderValue]}
            onValueChange={(v) => setSimulatedTime(v[0])}
            disabled={maxTime <= minTime}
            className="w-full cursor-pointer"
          />
        </div>
      </motion.div>
    </div>
  );
}
