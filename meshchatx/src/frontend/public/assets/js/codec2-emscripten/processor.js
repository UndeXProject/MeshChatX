class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.sourceSampleRate = globalThis.sampleRate || 8000;
        this.targetSampleRate = 8000;
        this.inputBuffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        this.port.onmessage = (event) => {
            if (event.data?.type === "flush") {
                this.flush();
                this.port.postMessage({ type: "flushed" });
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const inputData = input[0];
            for (let i = 0; i < inputData.length; i++) {
                if (this.bufferIndex < this.bufferSize) {
                    this.inputBuffer[this.bufferIndex++] = inputData[i];
                }
                if (this.bufferIndex === this.bufferSize) {
                    const downsampledBuffer = this.downsampleBuffer(
                        this.inputBuffer,
                        this.sourceSampleRate,
                        this.targetSampleRate
                    );
                    this.port.postMessage(downsampledBuffer);
                    this.bufferIndex = 0;
                }
            }
        }
        return true;
    }

    flush() {
        if (this.bufferIndex === 0) {
            return;
        }
        const pending = this.inputBuffer.slice(0, this.bufferIndex);
        const downsampledBuffer = this.downsampleBuffer(
            pending,
            this.sourceSampleRate,
            this.targetSampleRate
        );
        if (downsampledBuffer.length > 0) {
            this.port.postMessage(downsampledBuffer);
        }
        this.bufferIndex = 0;
    }

    downsampleBuffer(buffer, sourceSampleRate, targetSampleRate) {
        if (targetSampleRate === sourceSampleRate) {
            return new Float32Array(buffer);
        }
        const sampleRateRatio = sourceSampleRate / targetSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0;
            let count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }
}

registerProcessor("audio-processor", AudioProcessor);
