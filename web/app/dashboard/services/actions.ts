"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createService(formData: FormData) {
  const supabase = await createClient(); const {data:{user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { error } = await supabase.from("services").insert({
    user_id:user.id, name:String(formData.get("name")||"").trim(),
    duration_minutes:Number(formData.get("duration")||30),
    buffer_before:Number(formData.get("bufferBefore")||0), buffer_after:Number(formData.get("bufferAfter")||0),
    price_cents:Math.round(Number(formData.get("price")||0)*100), active:true,
  });
  if (error) throw new Error(error.message); revalidatePath("/dashboard/services");
}

export async function toggleService(id:string, active:boolean) {
  const supabase=await createClient(); const {error}=await supabase.from("services").update({active}).eq("id",id);
  if(error) throw new Error(error.message); revalidatePath("/dashboard/services");
}
