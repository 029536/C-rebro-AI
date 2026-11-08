import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MeetingDetailContent } from "@/components/meeting/MeetingDetailContent";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="flex flex-1 flex-col">
      <Link
        href="/"
        className="flex h-11 items-center gap-2 px-4 text-sm font-medium text-text-secondary"
      >
        <ArrowLeft size={18} />
        Reuniões
      </Link>
      <MeetingDetailContent meetingId={id} />
    </div>
  );
}
