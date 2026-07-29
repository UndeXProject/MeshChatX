import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const WORKLET_SOURCE = readFileSync(
    resolve(process.cwd(), "meshchatx/src/frontend/public/assets/js/codec2-emscripten/processor.js"),
    "utf8"
);
const RECORDER_SOURCE = readFileSync(
    resolve(process.cwd(), "meshchatx/src/frontend/public/assets/js/codec2-emscripten/codec2-microphone-recorder.js"),
    "utf8"
);

describe("Codec2 audio recorder", () => {
    it("flushes and downsamples a short AudioWorklet recording", () => {
        let Processor = null;
        class AudioWorkletProcessor {
            constructor() {
                this.port = {
                    messages: [],
                    onmessage: null,
                    postMessage(value) {
                        this.messages.push(value);
                    },
                };
            }
        }
        const sandbox = {
            AudioWorkletProcessor,
            Float32Array,
            sampleRate: 48000,
            registerProcessor(name, implementation) {
                expect(name).toBe("audio-processor");
                Processor = implementation;
            },
        };
        sandbox.globalThis = sandbox;
        runInNewContext(WORKLET_SOURCE, sandbox);

        const processor = new Processor();
        processor.process([[new Float32Array(480).fill(0.5)]], [], {});
        expect(processor.port.messages).toHaveLength(0);

        processor.port.onmessage({ data: { type: "flush" } });

        expect(processor.port.messages).toHaveLength(2);
        expect(processor.port.messages[0]).toHaveLength(80);
        expect(Array.from(processor.port.messages[0])).toEqual(new Array(80).fill(0.5));
        expect(processor.port.messages[1]).toEqual({ type: "flushed" });
    });

    it("keeps the final ScriptProcessor samples when recording stops", async () => {
        let encodedSamples = null;
        const encodeWav = vi.fn((samples) => {
            encodedSamples = Array.from(samples);
            return new Uint8Array([1]);
        });
        const audioFileToRaw = vi.fn(async () => new Uint8Array([2]));
        const runEncode = vi.fn(async () => new Uint8Array([3]));
        const sandbox = {
            ArrayBuffer,
            Float32Array,
            Uint8Array,
            WavEncoder: { encodeWAV: encodeWav },
            Codec2Lib: { audioFileToRaw, runEncode },
            console,
            setTimeout,
        };
        sandbox.globalThis = sandbox;
        runInNewContext(`${RECORDER_SOURCE}\nglobalThis.Codec2MicrophoneRecorder = Codec2MicrophoneRecorder;`, sandbox);

        const recorder = new sandbox.Codec2MicrophoneRecorder();
        recorder.scriptProcessorAccumulator = {
            bufferIndex: 3,
            inputBuffer: new Float32Array([0.25, -0.5, 0.75, 0]),
            sourceSampleRate: 8000,
        };

        await expect(recorder.stop()).resolves.toEqual(new Uint8Array([3]));
        expect(encodedSamples).toEqual([0.25, -0.5, 0.75]);
        expect(encodeWav).toHaveBeenCalledWith(expect.any(Float32Array), 8000);
        expect(audioFileToRaw).toHaveBeenCalledOnce();
        expect(runEncode).toHaveBeenCalledWith("1200", new Uint8Array([2]));
    });
});
