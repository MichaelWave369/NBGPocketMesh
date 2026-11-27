"""Separate exact oracle: Python stdlib Fraction, no JS arithmetic imported."""
import itertools as it
import json
import math
import sys
from fractions import Fraction as F
from pathlib import Path

Z = (F(0), F(0))
O = (F(1), F(0))
def dec(x):
    if len(x) == 2:
        return F(x[0]), F(x[1])
    return F(int(x[0]), int(x[2])), F(int(x[1]), int(x[2]))
def enc(x, gaussian=False):
    if gaussian:
        if any(a.denominator != 1 for a in x):
            raise ValueError("not Gaussian integer")
        return [int(a) for a in x]
    d = math.lcm(x[0].denominator, x[1].denominator)
    return [str(int(x[0]*d)), str(int(x[1]*d)), str(d)]
def add(a,b): return a[0]+b[0], a[1]+b[1]
def neg(a): return -a[0], -a[1]
def conj(a): return a[0], -a[1]
def mul(a,b): return a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]
def scale(a,n): return a[0]/n, a[1]/n
def total(xs):
    r = Z
    for x in xs: r = add(r,x)
    return r
def mat(a): return [[dec(x) for x in row] for row in a]
def wire(a,g=False): return [[enc(x,g) for x in row] for row in a]
def ident(n): return [[O if i==j else Z for j in range(n)] for i in range(n)]
def mm(a,b):
    return [[total(mul(x,y) for x,y in zip(row,col,strict=True)) for col in zip(*b)] for row in a]
def adj(a): return [[conj(x) for x in col] for col in zip(*a)]
def trace(a): return total(a[i][i] for i in range(len(a)))
def sig(a):
    # Newton identities from traces of powers, not JS Leibniz expansion.
    n=len(a); powers=[]; p=ident(n)
    for _ in range(n):
        p=mm(p,a); powers.append(trace(p))
    c=[O]
    for k in range(1,n+1):
        c.append(scale(neg(total(mul(c[k-i],powers[i-1]) for i in range(1,k+1))),k))
    return {"dimension":n,"trace":enc(powers[0]),"determinant":enc(neg(c[-1]) if n%2 else c[-1]),"characteristic":[enc(x) for x in reversed(c)]}
def ch(a,coeff):
    n=len(a); out=[[Z]*n for _ in range(n)]; p=ident(n)
    for c in coeff:
        out=[[add(out[i][j],mul(dec(c),p[i][j])) for j in range(n)] for i in range(n)]
        p=mm(p,a)
    return all(x==Z for row in out for x in row)
def edge_maps(c):
    out={}; I=ident(c["frames"][0]["dim"])
    for e in c["edges"]:
        u=c["frames"][e["u"]]["frame"]; v=c["frames"][e["v"]]["frame"]
        a,b=mat(e["f"]),mat(e["i"])
        if mm(a,b)!=I or mm(b,a)!=I: raise ValueError("invalid inverse")
        out[u,v]=a; out[v,u]=b
    return out
def walk(edges,path,n):
    p=ident(n)
    for u,v in zip(path,path[1:]): p=mm(edges[u,v],p)
    return p
def flat(c,edges):
    # Enumerate all simple cycles, not root potentials.
    names=[f["frame"] for f in c["frames"]]; n=c["frames"][0]["dim"]
    for k in range(3,len(names)+1):
        for p in it.permutations(names,k):
            cycle=p+(p[0],)
            if all((u,v) in edges for u,v in zip(cycle,cycle[1:])):
                if walk(edges,cycle,n)!=ident(n): return False
    return True
def tensor_oracle(net):
    # Materialize tuple-keyed tables and enumerate all assignments.
    legs={}; tables=[]
    for t in net:
        names=[l["id"] for l in t["legs"]]
        for l in t["legs"]: legs.setdefault(l["id"],[]).append(l)
        keys=it.product(*(range(l["dim"]) for l in t["legs"]))
        tables.append((names,dict(zip(keys,map(dec,t["data"]),strict=True))))
    ext=sorted(k for k,v in legs.items() if len(v)==1)
    internal=sorted(k for k,v in legs.items() if len(v)==2)
    if len(ext)+len(internal)!=len(legs): raise ValueError("hyperedge")
    def assignments(names): return it.product(*(range(legs[k][0]["dim"]) for k in names))
    output=[]
    for outer in assignments(ext):
        values=[]
        for inner in assignments(internal):
            a=dict(zip(ext+internal,outer+inner)); value=O
            for names,table in tables: value=mul(value,table[tuple(a[n] for n in names)])
            values.append(value)
        output.append(enc(total(values)))
    return {"legs":[legs[k][0] for k in ext],"data":output,"authority":"NONE"}
def expected(c,actual):
    s=c["stage"]
    if s==0:
        a,b,d=map(mat,(c["a"],c["b"],c["c"]))
        return {"product":wire(mm(a,b),True),"adjoint":wire(adj(a),True),"direct":wire(mm(d,mm(a,b)),True)}
    if s==1:
        a,b,t,ti=map(mat,(c["a"],c["b"],c["t"],c["ti"]))
        if mm(t,ti)!=ident(2) or mm(ti,t)!=ident(2): raise ValueError("bridge")
        return {"left":wire(mm(t,a)),"right":wire(mm(b,ti)),"glued":wire(mm(b,a)),"metric":wire(mm(adj(ti),ti))}
    if s==2:
        e=edge_maps(c); n=c["frames"][0]["dim"]; p=c["path"]; h=walk(e,p,n); consistent=flat(c,e)
        # Witness choice depends on JS tree. Verify the provided path independently,
        # and require at least one nonidentity witness for a nonflat graph.
        witnesses=actual["witnesses"]
        if bool(witnesses)==consistent: raise ValueError("witness coverage")
        out=[]
        for w in witnesses:
            path=w["loop"]
            if not path or path[0]!=path[-1]: raise ValueError("not closed")
            v=walk(e,path,n)
            if v==ident(n): raise ValueError("identity witness")
            out.append({"loop":path,"holonomy":wire(v)})
        return {"consistent":consistent,"forward":wire(h),"inverse":wire(walk(e,p[::-1],n)),"identity":h==ident(n),"witnesses":out}
    if s==3:
        e=edge_maps(c); n=c["frames"][0]["dim"]; g={r["frame"]:mat(r["metric"]) for r in c["metrics"]}
        edges=[]
        for u,v in sorted(e):
            if u>=v: continue
            a=mm(mm(adj(e[u,v]),g[v]),e[u,v])
            edges.append({"from":u,"to":v,"compatible":a==g[u],"actual":wire(a)})
        compatible=all(x["compatible"] for x in edges); transport=None
        if compatible:
            p=c["path"]; x=mat(c["state"]); y=mm(walk(e,p,n),x)
            transport={"state":wire(y),"before":enc(mm(mm(adj(x),g[p[0]]),x)[0][0]),"after":enc(mm(mm(adj(y),g[p[-1]]),y)[0][0])}
        return {"compatible":compatible,"edges":edges,"transport":transport}
    if s==4:
        a=mat(c["h"]); v=sig(a); return {"signature":v,"cayleyHamilton":ch(a,v["characteristic"])}
    if s==5:
        t=tensor_oracle(c["net"]); return {"tensor":t,"plans":[t for _ in c["plans"]]}
    raise ValueError("stage")
def verify(fixtures,report):
    if fixtures["schema"]!="PhiNullMesh.R6.fixtures.v1" or report["schema"]!="PhiNullMesh.R6.javascript.v1" or fixtures["authority"]!="NONE" or report["authority"]!="NONE": raise ValueError("schema")
    cases=fixtures["cases"]; records=report["records"]
    if len(cases)!=54 or len(records)!=54 or len({c["id"] for c in cases})!=54: raise ValueError("inventory")
    counts=[0]*6
    for c,r in zip(cases,records,strict=True):
        if (c["id"],c["stage"])!=(r["id"],r["stage"]): raise ValueError("record identity")
        if expected(c,r["result"])!=r["result"]: raise ValueError("mismatch "+c["id"])
        counts[c["stage"]]+=1
    if counts!=[9]*6: raise ValueError("coverage")
    return counts
def main():
    import copy
    fixtures=json.loads(Path(sys.argv[1]).read_text()); report=json.loads(Path(sys.argv[2]).read_text())
    counts=verify(fixtures,report)
    # Mutate one meaningful output per stage; preserve schema and input.
    mutations=0
    for stage in range(6):
        bad=copy.deepcopy(report)
        result=next(r["result"] for r in bad["records"] if r["stage"]==stage)
        if stage==0: result["product"][0][0][0]+=1
        if stage==1: result["glued"][0][0]=["999","0","1"]
        if stage==2: result["consistent"]=not result["consistent"]
        if stage==3: result["edges"][0]["compatible"]=not result["edges"][0]["compatible"]
        if stage==4: result["signature"]["trace"]=["999","0","1"]
        if stage==5: result["tensor"]["data"][0]=["999","0","1"]
        try: verify(fixtures,bad)
        except ValueError: mutations+=1
        else: raise ValueError("mutation escaped "+str(stage))
    print(json.dumps({"schema":"PhiNullMesh.R6.oracle.v1","authority":"NONE","release":"BLOCKED","matchedRecords":sum(counts),"perStage":counts,"mutationsRejected":mutations},sort_keys=True))
if __name__=="__main__": main()
