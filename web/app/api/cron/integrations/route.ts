import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { deliverIntegrationEvent } from "@/lib/integrations/make";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request:Request){if(!cronAuthorized(request))return NextResponse.json({error:"unauthorized"},{status:401});const supabase=createServiceClient();const {data:events}=await supabase.from("integration_events").select("id").is("delivered_at",null).lt("attempts",10).order("created_at").limit(20);let delivered=0;for(const event of events||[]){if(await deliverIntegrationEvent(event.id))delivered++;}return NextResponse.json({checked:events?.length||0,delivered});}
