"""R8 integrated evidence producer. Executes trusted repository source locally.
Not a sandbox, signature, independent witness or production grant.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "research/phi-nullmesh-r8/contract.json"
LIMIT = 8 * 1024 * 1024

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def load_contract():
    c = json.loads(CONTRACT.read_bytes())
    require(c["schema"] == "PhiNullMesh.R8.contract.v1" and c["authority"] == "NONE" and c["release"] == "BLOCKED", "contract")
    return c

def source_inventory(c):
    out = {}
    for name, blob in sorted(c["sourceBlobs"].items()):
        p = ROOT / name
        require(p.resolve().is_relative_to(ROOT) and p.is_file() and not p.is_symlink(), "source path " + name)
        data = p.read_bytes()
        require(git_blob(data) == blob, "source drift " + name)
        out[name] = {"gitBlob": blob, "sha256": sha(data), "bytes": len(data)}
    for p in (CONTRACT, Path(__file__).resolve()):
        data = p.read_bytes()
        out[str(p.relative_to(ROOT))] = {"sha256": sha(data), "bytes": len(data)}
    return out

def execute(args):
    p = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=180, check=True)
    require(len(p.stdout) <= LIMIT and len(p.stderr) <= LIMIT, "output limit")
    require(not p.stderr.strip(), "unexpected stderr: " + repr(args))
    return p.stdout

def twice(args):
    a, b = execute(args), execute(args)
    require(a == b, "nonreproducible output: " + repr(args))
    return a

def parse_stage(raw, count, i):
    r = json.loads(raw)
    require(r["schema"] == f"PhiNullMesh.R{i}.v1" and r["authority"] == "NONE" and r["release"] == "BLOCKED", "stage contract")
    require(type(r["checks"]) is int and r["checks"] == count, "assertion count")
    return r

def parse_proofs(raw, expected):
    found = {}
    for line in raw.decode("utf-8").splitlines():
        m = re.fullmatch(r"'PhiNullMesh\.R7\.([a-z_]+)' (does not depend on any axioms|depends on axioms: \[([^\]]*)\])", line.strip())
        require(m is not None, "unexpected proof output: " + line)
        name = m[1]
        require(name not in found, "duplicate proof")
        found[name] = [] if m[3] is None else [x.strip() for x in m[3].split(",")]
    require(found == expected, "proof dependency mismatch")
    return found

def verify_manifest(directory):
    m = json.loads((directory / "manifest.json").read_bytes())
    require(m["schema"] == "PhiNullMesh.R8.manifest.v1" and m["authority"] == "NONE" and m["release"] == "BLOCKED", "manifest contract")
    c = load_contract()
    require(m["sources"] == source_inventory(c), "source inventory mismatch")
    names = {f"r{i}.json" for i in range(6)} | {"r6-js.json","r6-oracle.json","r7-lean.txt"}
    require(set(m["reports"]) == names, "report inventory")
    require({p.name for p in directory.iterdir()} == names | {"manifest.json"}, "unexpected evidence files")
    for name, rec in m["reports"].items():
        p = directory / name
        require(p.is_file() and not p.is_symlink(), "report path")
        b = p.read_bytes()
        require(rec == {"sha256": sha(b), "bytes": len(b)}, "report digest mismatch " + name)
    counts = [parse_stage((directory / f"r{i}.json").read_bytes(), n, i)["checks"] for i,n in enumerate(c["checks"])]
    oracle = json.loads((directory / "r6-oracle.json").read_bytes())
    require(oracle == c["oracle"], "oracle report")
    js = json.loads((directory / "r6-js.json").read_bytes())
    require(js["schema"] == "PhiNullMesh.R6.javascript.v1" and js["authority"] == "NONE" and len(js["records"]) == 54, "JS report")
    proofs = parse_proofs((directory / "r7-lean.txt").read_bytes(), c["axioms"])
    require(m["summary"] == {"assertions":sum(counts),"perStage":counts,"matchedRecords":54,"mutationsRejected":6,"theorems":len(proofs),"axiomFree":sum(not a for a in proofs.values()),"quotSound":sum(a == ["Quot.sound"] for a in proofs.values())}, "summary mismatch")
    return m["summary"]

def build(directory):
    c = load_contract()
    sources = source_inventory(c)
    node = execute(["node","--version"]).decode().strip()
    lean = execute(["lean","--version"]).decode().strip()
    require(node.startswith("v22."), "Node 22 required")
    require(sys.version_info[:2] == (3,11), "Python 3.11 required")
    require("version 4.19.0," in lean and "commit 6caaee842e94," in lean, "Lean release mismatch")
    head = execute(["git","rev-parse","HEAD"]).decode().strip()
    reports = {}
    for i,n in enumerate(c["checks"]):
        raw = twice(["node",f"scripts/phi-nullmesh-r{i}.mjs"])
        parse_stage(raw,n,i)
        reports[f"r{i}.json"] = raw
    reports["r6-js.json"] = twice(["node","scripts/phi-nullmesh-r6.mjs"])
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "js.json"
        p.write_bytes(reports["r6-js.json"])
        reports["r6-oracle.json"] = twice([sys.executable,"scripts/phi_nullmesh_r6_oracle.py","research/phi-nullmesh-r6/fixtures.json",str(p)])
    require(json.loads(reports["r6-oracle.json"]) == c["oracle"], "oracle result")
    reports["r7-lean.txt"] = twice(["lean","research/phi-nullmesh-r7/BoundaryLaws.lean"])
    proofs = parse_proofs(reports["r7-lean.txt"],c["axioms"])
    require(sources == source_inventory(c), "source changed during experiment")
    summary = {"assertions":sum(c["checks"]),"perStage":c["checks"],"matchedRecords":54,"mutationsRejected":6,"theorems":len(proofs),"axiomFree":sum(not a for a in proofs.values()),"quotSound":sum(a==["Quot.sound"] for a in proofs.values())}
    manifest = {"schema":"PhiNullMesh.R8.manifest.v1","authority":"NONE","release":"BLOCKED","classification":"REPRODUCED_RESEARCH_EVIDENCE","head":head,"baseline":c["baseline"],"toolchains":{"node":node,"python":sys.version.split()[0],"lean":lean},"sources":sources,"reports":{k:{"sha256":sha(v),"bytes":len(v)} for k,v in sorted(reports.items())},"summary":summary}
    directory.mkdir(parents=False,exist_ok=False)
    for k,v in reports.items(): (directory/k).write_bytes(v)
    (directory/"manifest.json").write_text(json.dumps(manifest,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    return verify_manifest(directory)

def self_test():
    c=load_contract()
    source_inventory(c)
    text="\n".join(f"'PhiNullMesh.R7.{n}' "+("does not depend on any axioms" if not a else "depends on axioms: ["+", ".join(a)+"]") for n,a in c["axioms"].items())+"\n"
    require(parse_proofs(text.encode(),c["axioms"])==c["axioms"],"parser")
    for broken in (text.replace("Quot.sound","sorryAx"),text+"extra\n",text+text,text.split("\n",1)[1]):
        try: parse_proofs(broken.encode(),c["axioms"])
        except ValueError: pass
        else: raise ValueError("proof mutation escaped")
    print("R8 parser self-test passed: 4 proof report mutations rejected")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("mode",choices=["build","verify","self-test"])
    p.add_argument("directory",nargs="?",type=Path)
    a=p.parse_args()
    if a.mode=="self-test":
        self_test(); return
    require(a.directory is not None,"directory required")
    result=build(a.directory) if a.mode=="build" else verify_manifest(a.directory)
    print(json.dumps(result,sort_keys=True))
if __name__=="__main__":
    main()
