import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import BookingForm from "./booking-form";

export default async function PublicBookingPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const supabase=createPublicClient();
  const {data:profile}=await supabase.from("public_profiles").select("user_id,business_name,description,city,slug").ilike("slug",slug).eq("active",true).maybeSingle();
  if(!profile) notFound();
  const {data:services}=await supabase.from("services").select("id,name,description,duration_minutes,price_cents").eq("user_id",profile.user_id).eq("active",true).order("name");
  return <main><div className="card" style={{maxWidth:760,margin:"20px auto"}}><span className="badge">Agendamento online</span><h1>{profile.business_name}</h1>{profile.city&&<p className="muted" style={{marginTop:-8}}>{profile.city}</p>}{profile.description&&<p className="muted">{profile.description}</p>}<BookingForm slug={profile.slug} services={services||[]}/></div></main>;
}
