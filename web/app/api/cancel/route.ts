import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCancelToken } from "@/lib/cancel-token";
import { deliverIntegrationEvent } from "@/lib/integrations/make";
import { createServiceClient } from "@/lib/supabase/service";

const schema=z.object({token:z.string().min(20).max(500)});
const errors:Record<string,{message:string;status:number}>={appointment_not_found:{message:"Agendamento não encontrado",status:404},appointment_not_active:{message:"Este agendamento não está mais ativo",status:409},appointment_already_started:{message:"O horário do agendamento já começou",status:409}};
export async function POST(request:Request){const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Token inválido"},{status:400});const verified=verifyCancelToken(parsed.data.token);if(!verified)return NextResponse.json({error:"Link inválido ou expirado"},{status:400});const supabase=createServiceClient();const {data,error}=await supabase.rpc("cancel_appointment_by_client",{p_appointment_id:verified.appointmentId});if(error){const known=Object.entries(errors).find(([key])=>error.message.includes(key));return NextResponse.json({error:known?.[1].message||"Não foi possível cancelar"},{status:known?.[1].status||500});}const row=data?.[0];if(!row)return NextResponse.json({error:"Não foi possível cancelar"},{status:500});if(row.integration_event_id)await deliverIntegrationEvent(row.integration_event_id).catch(()=>false);return NextResponse.json({success:true});}
