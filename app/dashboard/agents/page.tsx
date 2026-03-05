import { Robot } from '@phosphor-icons/react/dist/ssr';

export default function AgentsPage() {
    return (
        <div className="flex flex-col h-full bg-[#FAFAFA]">
            <div className="flex items-start justify-between px-8 py-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-zinc-900">Agents</h1>
                    <p className="mt-1 text-sm text-zinc-500 text-muted-foreground">
                        Specialized AI assistants to handle specific tasks and use cases.
                    </p>
                </div>
                <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 transition">
                    + Create agent
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Subtle dot background block */}
                <div
                    className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"
                    aria-hidden="true"
                />

                <div className="relative text-center flex flex-col items-center max-w-sm">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-100 ring-1 ring-zinc-900/5">
                        <Robot weight="fill" className="h-8 w-8 text-indigo-500" />
                    </div>
                    <h2 className="mb-2 text-lg font-semibold text-zinc-900">No agent found</h2>
                    <p className="mb-6 text-sm text-zinc-500">
                        Create a new agent to handle specific tasks and use cases.
                    </p>
                    <button className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 transition">
                        Create agent
                    </button>
                </div>
            </div>
        </div>
    );
}
