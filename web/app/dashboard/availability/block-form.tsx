"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BlockForm(){
  const [message,setMessage]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setMessage("");const f=new FormData(e.currentTarget);const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user){setMessage("Sessão expirada");return;}const starts=new Date(String(f.get("starts")));const ends=new Date(String(f.get("ends")));const {error}=await supabase.from("schedule_blocks").insert({user_id:user.id,starts_at:starts.toISOString(),ends_at:ends.toISOString(),type:String(f.get("type")),reason:String(f.get("reason")||"")});setMessage(error?error.message:"Bloqueio criado. Atualize a página para vê-lo.");if(!error)e.currentTarget.reset();}
  return <form onSubmit={submit} className="stack"><label>Início<input type="datetime-local" name="starts" required/></label><label>Fim<input type="datetime-local" name="ends" required/></label><label>Tipo<select name="type"><option value="break">Pausa</option><option value="timeoff">Folga</option><option value="blocked">Bloqueado</option></select></label><label>Motivo<input name="reason" maxLength={200}/></label><button>Bloquear horário</button>{message&&<p className="muted">{message}</p>}</form>;
}
