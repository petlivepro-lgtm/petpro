import "server-only";
import type { CleanFile } from "@mylivepet/uploads";
import { storePublicImage } from "@/lib/upload-guard";

/** Grava a foto do pet (já conferida por guardUpload) e retorna a URL pública. */
export async function uploadPetPhoto(tenantId: string, file: CleanFile): Promise<string | null> {
  return storePublicImage("pet-photos", tenantId, file);
}
