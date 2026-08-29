#!/usr/bin/env python3
import json, os, urllib.request, urllib.error
TOKEN=os.environ["GITHUB_TOKEN"]; REPO=os.environ["GITHUB_REPOSITORY"]; BASE=f"https://api.github.com/repos/{REPO}"
MAPPING={"Sprint 0 — Segurança + Banco":[1,2,3,4,15,16],"Sprint 1 — Motor + Fluxo":[5,6,7,8],"Sprint 2 — WhatsApp + Stripe":[9,10],"Sprint 3 — Planos + Trial":[11,12],"Sprint 4 — Landing + Beta":[13,14]}
def api(method,path,payload=None):
    data=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(BASE+path,data=data,method=method,headers={"Authorization":f"Bearer {TOKEN}","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"})
    with urllib.request.urlopen(req) as r:return json.load(r)
existing=api("GET","/milestones?state=all&per_page=100"); by_title={m["title"]:m for m in existing}
for title,issues in MAPPING.items():
    milestone=by_title.get(title) or api("POST","/milestones",{"title":title,"state":"open"})
    for number in issues: api("PATCH",f"/issues/{number}",{"milestone":milestone["number"]})
    print(f"{title}: {len(issues)} issues")
