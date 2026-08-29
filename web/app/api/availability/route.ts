import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const querySchema=z.object({slug:z.string().min(3).max(50),serviceId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
export async function GET(request:Request){const url=new URL(request.url);const parsed=querySchema.safeParse(Object.fromEntries(url.searchParams));if(!parsed.success)return NextResponse.json({error:"Parâmetros inválidos"},{status:400});const supabase=createServiceClient();const {data,error}=await supabase.rpc("get_available_slots",{p_slug:parsed.data.slug,p_service_id:parsed.data.serviceId,p_date:parsed.data.date});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({slots:data||[]},{headers:{"Cache-Control":"no-store"}});}
