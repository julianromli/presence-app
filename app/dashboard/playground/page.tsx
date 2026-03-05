import { CaretDown, ChatTeardropText, ClockCounterClockwise, CodeBlock, PaperPlaneRight, Plus, WarningCircle } from '@phosphor-icons/react/dist/ssr';

export default function PlaygroundPage() {
    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h1 className="text-xl font-semibold text-zinc-900">Playground</h1>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">
                        <CodeBlock weight="regular" className="h-4 w-4" />
                        Code
                    </button>
                    <button className="flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
                        <Plus weight="bold" className="h-4 w-4" />
                        Create Agent
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Configuration Pane */}
                <div className="w-[300px] shrink-0 border-r border-zinc-200 overflow-y-auto bg-white p-4">
                    <div className="mb-6">
                        <div className="mb-2 flex items-center gap-1.5">
                            <label className="text-sm font-medium text-zinc-700">Model</label>
                            <WarningCircle weight="fill" className="h-3.5 w-3.5 text-zinc-300" />
                        </div>
                        <button className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm hover:bg-zinc-50">
                            <div className="flex flex-col">
                                <span className="font-semibold text-zinc-900">Mistral Medium</span>
                                <span className="text-xs text-zinc-500">mistral-medium-latest</span>
                            </div>
                            <CaretDown weight="bold" className="h-4 w-4 text-zinc-400" />
                        </button>
                        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-zinc-400">
                            <span>temperature: <strong className="text-orange-500 font-medium tracking-wide">0.7</strong></span>
                            <span>max_tokens: <strong className="text-orange-500 font-medium tracking-wide">2048</strong></span>
                            <span>top_p: <strong className="text-orange-500 font-medium tracking-wide">1</strong></span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="mb-2 flex items-center gap-1.5">
                            <label className="text-sm font-medium text-zinc-700">Capabilities</label>
                            <WarningCircle weight="fill" className="h-3.5 w-3.5 text-zinc-300" />
                        </div>
                        <button className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50">
                            <span>Add +</span>
                        </button>
                    </div>

                    <div className="mb-6">
                        <div className="mb-2 flex items-center gap-1.5">
                            <label className="text-sm font-medium text-zinc-700">Response Format</label>
                            <WarningCircle weight="fill" className="h-3.5 w-3.5 text-zinc-300" />
                        </div>
                        <button className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50">
                            <span>Text</span>
                            <CaretDown weight="bold" className="h-4 w-4 text-zinc-400" />
                        </button>
                    </div>

                    <div className="mb-6">
                        <div className="mb-2 flex items-center gap-1.5">
                            <label className="text-sm font-medium text-zinc-700">Instructions</label>
                            <WarningCircle weight="fill" className="h-3.5 w-3.5 text-zinc-300" />
                        </div>
                        <textarea
                            className="w-full resize-none rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300 min-h-[160px]"
                            placeholder="Describe desired model behavior (tone, tool usage, response style)"
                        />
                    </div>
                </div>

                {/* Right Chat Area */}
                <div className="relative flex flex-1 flex-col bg-[#FDFDFD]">
                    {/* Subtle dot background */}
                    <div
                        className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"
                        aria-hidden="true"
                    />

                    <div className="relative z-10 flex min-h-14 items-center justify-end px-4 pt-4 pb-2">
                        <div className="flex items-center gap-3">
                            <button className="rounded-full border border-zinc-200 bg-white p-1.5 text-zinc-500 shadow-sm hover:text-zinc-900">
                                <ClockCounterClockwise weight="bold" className="h-4 w-4" />
                            </button>
                            <button className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">
                                <Plus weight="bold" className="h-4 w-4" />
                                New Chat
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-1 items-center justify-center p-8">
                        <p className="text-2xl font-medium text-zinc-300/80">Start a new chat</p>
                    </div>

                    <div className="relative z-10 p-4">
                        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:ring-1 focus-within:ring-zinc-300">
                            <textarea
                                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                                placeholder="Type a message..."
                                rows={1}
                            />
                            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-50">
                                <PaperPlaneRight weight="fill" className="h-5 w-5 -rotate-90" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
