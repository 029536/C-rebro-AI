// Gerado à mão a partir das migrações 0001, 0002, 0005, 0006, 0007, 0008, 0009, 0010, 0011,
// 0012, 0013, 0014, 0015, 0016, 0017, 0018 e 0019 (sem acesso a Docker/Supabase CLI local
// neste ambiente). Depois que o projeto Supabase existir e as migrações forem aplicadas,
// regenere com:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      meetings: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          status: "recording" | "ready" | "analyzed";
          meeting_type: "client" | "internal";
          client_name: string | null;
          participants: Json;
          context: string | null;
          archived_at: string | null;
          project_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          focus: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          status?: "recording" | "ready" | "analyzed";
          meeting_type?: "client" | "internal";
          client_name?: string | null;
          participants?: Json;
          context?: string | null;
          archived_at?: string | null;
          project_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          focus?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meetings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_chunks: {
        Row: {
          id: string;
          meeting_id: string;
          idx: number;
          client_chunk_id: string;
          part_no: number;
          transcript: string;
          status: "pending" | "done" | "error";
          error: string | null;
          audio_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          idx: number;
          client_chunk_id: string;
          part_no?: number;
          transcript?: string;
          status?: "pending" | "done" | "error";
          error?: string | null;
          audio_seconds?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_chunks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meeting_chunks_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_checkpoints: {
        Row: {
          id: string;
          meeting_id: string;
          part_no: number;
          from_chunk_idx: number;
          to_chunk_idx: number;
          summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          part_no: number;
          from_chunk_idx: number;
          to_chunk_idx: number;
          summary: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_checkpoints"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meeting_checkpoints_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      copilot_notes: {
        Row: {
          id: string;
          meeting_id: string;
          kind: "auto" | "manual";
          after_chunk_idx: number | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          kind: "auto" | "manual";
          after_chunk_idx?: number | null;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["copilot_notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "copilot_notes_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      analyses: {
        Row: {
          id: string;
          meeting_id: string;
          content_md: string;
          focus: string | null;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          content_md: string;
          focus?: string | null;
          model: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analyses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "analyses_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          meeting_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "chat_messages_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_minutes: {
        Row: {
          id: string;
          meeting_id: string;
          content: Json | null;
          edited_ata_formal: string | null;
          status: "pending" | "generating" | "ready" | "error";
          error: string | null;
          error_detail: string | null;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          content?: Json | null;
          edited_ata_formal?: string | null;
          status?: "pending" | "generating" | "ready" | "error";
          error?: string | null;
          error_detail?: string | null;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_minutes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_opinions: {
        Row: {
          id: string;
          meeting_id: string;
          created_at: string;
          offset_seconds: number;
          text: string;
          kind: "opiniao" | "pergunta" | "resposta";
          prompt: string | null;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          created_at?: string;
          offset_seconds?: number;
          text: string;
          kind?: "opiniao" | "pergunta" | "resposta";
          prompt?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_opinions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meeting_opinions_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_reviews: {
        Row: {
          id: string;
          meeting_id: string;
          content: Json | null;
          status: "pending" | "generating" | "ready" | "error";
          error: string | null;
          error_detail: string | null;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          content?: Json | null;
          status?: "pending" | "generating" | "ready" | "error";
          error?: string | null;
          error_detail?: string | null;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_reviews"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meeting_reviews_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_links: {
        Row: {
          meeting_id: string;
          previous_meeting_id: string;
          link_type: "context" | "session";
          created_at: string;
        };
        Insert: {
          meeting_id: string;
          previous_meeting_id: string;
          link_type?: "context" | "session";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_links"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meeting_links_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_links_previous_meeting_id_fkey";
            columns: ["previous_meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          repo_map: string;
          file_count: number;
          total_bytes: number;
          imported_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          description?: string;
          repo_map?: string;
          file_count?: number;
          total_bytes?: number;
          imported_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          path: string;
          language: string | null;
          size_bytes: number;
          content_hash: string;
          content: string;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          path: string;
          language?: string | null;
          size_bytes?: number;
          content_hash: string;
          content: string;
          summary?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_files"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_documents: {
        Row: {
          id: string;
          project_id: string;
          filename: string;
          size_bytes: number;
          content_hash: string;
          content: string;
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          filename: string;
          size_bytes?: number;
          content_hash: string;
          content: string;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_plans: {
        Row: {
          id: string;
          meeting_id: string;
          summary: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          summary?: string;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dev_plans"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dev_plans_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_tasks: {
        Row: {
          id: string;
          meeting_id: string;
          plan_id: string;
          project_id: string | null;
          position: number;
          title: string;
          description: string;
          acceptance: string;
          priority: "alta" | "media" | "baixa";
          depends_on: number[];
          prompt_md: string;
          status: "todo" | "doing" | "done";
          progress_note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          plan_id: string;
          project_id?: string | null;
          position?: number;
          title: string;
          description?: string;
          acceptance?: string;
          priority?: "alta" | "media" | "baixa";
          depends_on?: number[];
          prompt_md?: string;
          status?: "todo" | "doing" | "done";
          progress_note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dev_tasks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dev_tasks_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_tasks_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "dev_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      project_memory: {
        Row: {
          project_id: string;
          summary: string;
          locked_note: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          summary?: string;
          locked_note?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_memory"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "project_memory_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          owner_id: string;
          default_auto_opine: boolean;
          chunk_seconds: number;
          updated_at: string;
        };
        Insert: {
          owner_id?: string;
          default_auto_opine?: boolean;
          chunk_seconds?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      company_context: {
        Row: {
          owner_id: string;
          context: string;
          vocabulary: string;
          letterhead: string;
          letterhead_logo: string | null;
          updated_at: string;
        };
        Insert: {
          owner_id?: string;
          context?: string;
          vocabulary?: string;
          letterhead?: string;
          letterhead_logo?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_context"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      owns_meeting: {
        Args: { mid: string };
        Returns: boolean;
      };
      owns_project: {
        Args: { pid: string };
        Returns: boolean;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      search_meetings_content: {
        Args: { search_query: string };
        Returns: { kind: string; meeting_id: string; title: string; snippet: string; rank: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
