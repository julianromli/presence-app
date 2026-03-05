import { ArrowSquareOut, Faders, Microphone, MusicNotes, Waveform } from '@phosphor-icons/react/dist/ssr';

export default function AudioPage() {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white px-6 pb-4 pt-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold text-zinc-900">Speech to text</h1>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">Beta</span>
                </div>
                <a href="#" className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    <ArrowSquareOut weight="bold" className="h-4 w-4" />
                    Audio Transcription API docs
                </a>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center p-6">
                <div className="mb-16 -mt-16 flex items-center rounded-full border border-zinc-200 bg-zinc-100 p-1">
                    <button className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm">
                        Offline
                    </button>
                    <button className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700">
                        Realtime
                    </button>
                </div>

                <div className="flex w-full max-w-2xl flex-col items-center justify-center text-center">
                    <div className="relative mb-8 h-24 w-48">
                        <div className="absolute left-1/2 top-4 h-16 w-12 -translate-x-20 -rotate-12 rounded bg-white shadow-sm shadow-zinc-200 border border-zinc-100 flex items-center justify-center text-purple-400">
                            <MusicNotes weight="bold" className="h-4 w-4" />
                        </div>
                        <div className="absolute left-1/2 top-4 h-16 w-12 translate-x-8 rotate-12 rounded bg-white shadow-sm shadow-zinc-200 border border-zinc-100 flex items-center justify-center text-purple-400">
                            <MusicNotes weight="bold" className="h-4 w-4 flex -scale-x-100" />
                        </div>
                        <div className="absolute left-1/2 top-0 z-10 h-20 w-16 -translate-x-1/2 rounded-lg bg-indigo-500 shadow-md flex items-center justify-center text-white">
                            <Waveform weight="bold" className="h-8 w-8" />
                        </div>
                    </div>

                    <h2 className="mb-3 text-2xl font-bold text-zinc-900">Transcribe your audio & video files</h2>
                    <p className="mb-8 text-sm text-zinc-500">
                        10 Files Max &bull; 1024MB Each &bull; MP3, WAV, MP4, MOV, WEBM & more
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="flex items-center gap-2">
                            <button className="rounded-md bg-[#F05023] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d9461d]">
                                Upload files
                            </button>
                            <button className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">
                                <Microphone weight="bold" className="h-4 w-4" />
                                Record audio
                            </button>
                            <button className="flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200">
                                Paste files <kbd className="font-mono text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ctrl+v</kbd>
                            </button>
                            <button className="flex items-center justify-center rounded-md bg-zinc-100 p-2 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700">
                                <Faders weight="bold" className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-sm text-zinc-400">or drag and drop files here</p>
                    </div>
                </div>
            </div>

            <div className="mt-auto border-t border-zinc-100 p-4 text-center">
                <p className="text-xs text-zinc-500">
                    Need more? <a href="#" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900">Try the API</a>
                    . Process video files and integrate with our completions endpoints.
                </p>
            </div>
        </div>
    );
}
