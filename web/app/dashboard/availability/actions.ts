"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAvailabilityRule(formData:FormData){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Não autenticado");
  const {error}=await supabase.from("availability_rules").insert({user_id:user.id,day_of_week:Number(formData.get("day")),start_time:String(formData.get("start")),end_time:String(formData.get("end")),slot_interval_minutes:Number(formData.get("interval")||30),active:true});
  if(error) throw new Error(error.message); revalidatePath("/dashboard/availability");
}
