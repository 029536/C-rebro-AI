import { Modal } from "@/components/Modal";
import { MeetingDetailContent } from "@/components/meeting/MeetingDetailContent";

export default async function MeetingModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Modal>
      <MeetingDetailContent meetingId={id} />
    </Modal>
  );
}
