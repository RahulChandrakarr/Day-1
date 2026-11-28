import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JobListing, JobSave, JobSource, JobStatus } from "./jobs";

const COLUMNS =
  "id, source, source_id, title, company, url, location, pay, summary, status, notes, created_at, updated_at";

export async function getSavedJobs(): Promise<JobSave[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_saves")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .returns<JobSave[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function userId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) throw new Error("Not signed in.");
  return { supabase, userId: id };
}

export async function upsertJobSave(
  listing: JobListing,
  status: JobStatus = "saved",
  notes?: string,
) {
  const { supabase, userId: uid } = await userId();
  const { data, error } = await supabase
    .from("job_saves")
    .upsert(
      {
        user_id: uid,
        source: listing.source,
        source_id: listing.sourceId,
        title: listing.title.slice(0, 200),
        company: listing.company.slice(0, 120) || null,
        url: listing.url.slice(0, 500),
        location: listing.location.slice(0, 160) || null,
        pay: listing.pay?.slice(0, 80) ?? null,
        summary: listing.summary.slice(0, 800) || null,
        status,
        ...(notes != null ? { notes: notes.slice(0, 4000) } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source,source_id" },
    )
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function setJobSaveStatus(id: string, status: JobStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_saves")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setJobSaveNotes(id: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_saves")
    .update({ notes: notes.slice(0, 4000), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteJobSave(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("job_saves").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function findSaved(
  source: JobSource,
  sourceId: string,
): Promise<JobSave | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_saves")
    .select(COLUMNS)
    .eq("source", source)
    .eq("source_id", sourceId)
    .maybeSingle<JobSave>();
  if (error) throw new Error(error.message);
  return data;
}
