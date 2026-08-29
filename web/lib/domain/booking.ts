export function overlaps(aStart:number,aEnd:number,bStart:number,bEnd:number){return aStart<bEnd&&aEnd>bStart;}
export function freePlanLimitReached(used:number,limit=10){return used>=limit;}
export function busyWindow(startsAt:number,durationMinutes:number,bufferBefore:number,bufferAfter:number){const minute=60_000;return {start:startsAt-bufferBefore*minute,end:startsAt+(durationMinutes+bufferAfter)*minute};}
