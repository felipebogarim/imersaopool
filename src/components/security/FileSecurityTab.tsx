import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardDrive, FileWarning, Files, ScanLine, Loader2, AlertTriangle } from "lucide-react";

type Bucket = { id: string; name: string; public: boolean; created_at: string };
type Obj = { bucket_id: string; name: string; size: number; mimetype: string; updated_at: string };
type Event = {
  id: string; bucket: string; path: string; evento: string; usuario_email: string | null;
  tamanho_bytes: number | null; mimetype: string | null; nivel_risco: string; created_at: string;
};

const RISK_META: Record<string, string> = {
  info: "bg-slate-100 text-slate-700",
  baixo: "bg-lime-100 text-lime-800",
  medio: "bg-amber-100 text-amber-800",
  alto: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

function fmtBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function FileSecurityTab() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [filterRisco, setFilterRisco] = useState<string>("all");

  const bucketsQ = useQuery({
    queryKey: ["storage-buckets"],
    queryFn: async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      return (data ?? []) as Bucket[];
    },
  });

  const objectsQ = useQuery({
    queryKey: ["storage-objects"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_storage_objects");
      if (error) throw error;
      return (data ?? []) as Obj[];
    },
  });

  const eventsQ = useQuery({
    queryKey: ["file-sec-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("file_security_events")
        .select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Event[];
    },
  });

  const buckets = bucketsQ.data ?? [];
  const objects = objectsQ.data ?? [];

  const stats = useMemo(() => {
    const byBucket: Record<string, { count: number; size: number; public: boolean }> = {};
    for (const b of buckets) byBucket[b.name] = { count: 0, size: 0, public: b.public };
    for (const o of objects) {
      if (!byBucket[o.bucket_id]) byBucket[o.bucket_id] = { count: 0, size: 0, public: false };
      byBucket[o.bucket_id].count += 1;
      byBucket[o.bucket_id].size += Number(o.size ?? 0);
    }
    return byBucket;
  }, [buckets, objects]);

  const publicBuckets = buckets.filter(b => b.public);
  const totalFiles = objects.length;
  const totalSize = objects.reduce((s, o) => s + Number(o.size ?? 0), 0);

  async function scan() {
    setScanning(true);
    try {
      const anomalies: Array<Omit<Event, "id" | "created_at">> = [];
      // Detecta arquivos grandes (>50MB) e buckets públicos
      for (const o of objects) {
        const bucketPublic = buckets.find(b => b.name === o.bucket_id)?.public;
        if (bucketPublic) {
          anomalies.push({
            bucket: o.bucket_id, path: o.name, evento: "anomalia",
            usuario_email: null, tamanho_bytes: o.size, mimetype: o.mimetype,
            nivel_risco: "alto",
          });
        } else if (Number(o.size ?? 0) > 50 * 1024 * 1024) {
          anomalies.push({
            bucket: o.bucket_id, path: o.name, evento: "anomalia",
            usuario_email: null, tamanho_bytes: o.size, mimetype: o.mimetype,
            nivel_risco: "medio",
          });
        }
      }
      if (anomalies.length > 0) {
        const { error } = await supabase.from("file_security_events").insert(
          anomalies.map(a => ({ ...a, metadata: { motivo: "scan_automatico" } }))
        );
        if (error) throw error;
      }
      alert(`Varredura concluída. ${anomalies.length} anomalia(s) registrada(s).`);
      qc.invalidateQueries({ queryKey: ["file-sec-events"] });
    } catch (e: any) {
      alert(`Falha na varredura: ${e?.message ?? e}`);
    } finally {
      setScanning(false);
    }
  }

  const filteredEvents = (eventsQ.data ?? []).filter(e => {
    if (filterBucket !== "all" && e.bucket !== filterBucket) return false;
    if (filterRisco !== "all" && e.nivel_risco !== filterRisco) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><HardDrive className="h-4 w-4" /> Buckets</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{buckets.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Files className="h-4 w-4" /> Arquivos</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalFiles}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Espaço total</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{fmtBytes(totalSize)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><FileWarning className="h-4 w-4" /> Buckets públicos</CardTitle></CardHeader>
          <CardContent><div className={`text-3xl font-bold ${publicBuckets.length > 0 ? "text-red-700" : "text-emerald-700"}`}>{publicBuckets.length}</div></CardContent>
        </Card>
      </div>

      {publicBuckets.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Buckets públicos detectados</AlertTitle>
          <AlertDescription>
            {publicBuckets.map(b => b.name).join(", ")} — qualquer pessoa com o link consegue baixar os arquivos.
            Revise se essa exposição é intencional.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Buckets de armazenamento</CardTitle>
          <Button onClick={scan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
            Varrer anomalias
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Visibilidade</TableHead>
                <TableHead className="text-right">Arquivos</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map(b => {
                const s = stats[b.name] ?? { count: 0, size: 0, public: b.public };
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium font-mono text-sm">{b.name}</TableCell>
                    <TableCell>
                      {b.public
                        ? <Badge className="bg-red-100 text-red-800" variant="secondary">Público</Badge>
                        : <Badge className="bg-emerald-100 text-emerald-800" variant="secondary">Privado</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{fmtBytes(s.size)}</TableCell>
                    <TableCell className="text-xs">{new Date(b.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  </TableRow>
                );
              })}
              {buckets.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum bucket.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Eventos de segurança em arquivos</CardTitle>
            <div className="flex gap-2">
              <Select value={filterBucket} onValueChange={setFilterBucket}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Bucket" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os buckets</SelectItem>
                  {buckets.map(b => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRisco} onValueChange={setFilterRisco}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Risco" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os riscos</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="font-mono text-xs">{e.bucket}</TableCell>
                  <TableCell className="font-mono text-xs max-w-xs truncate" title={e.path}>{e.path}</TableCell>
                  <TableCell className="text-xs">{e.evento}</TableCell>
                  <TableCell className="text-xs">{e.usuario_email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{fmtBytes(e.tamanho_bytes)}</TableCell>
                  <TableCell>
                    <Badge className={RISK_META[e.nivel_risco] ?? RISK_META.info} variant="secondary">{e.nivel_risco}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEvents.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum evento registrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
