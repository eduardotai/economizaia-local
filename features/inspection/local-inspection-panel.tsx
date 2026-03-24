"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Database, Eye, FileSearch, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import type { LocalAuditEvent, LocalSnapshot } from "@/db/persistence-types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatScopeLabel(scope: string) {
  if (scope === "profile") return "perfil";
  if (scope === "document") return "documento";
  if (scope === "simulation") return "simulação";
  return scope;
}

function formatJsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Não foi possível serializar o payload local.";
  }
}

function statusBadgeVariant(status: LocalAuditEvent["status"]): "default" | "secondary" | "outline" {
  if (status === "error") return "outline";
  if (status === "warning") return "secondary";
  return "default";
}

export function LocalInspectionPanel() {
  const [auditEvents, setAuditEvents] = useState<LocalAuditEvent[]>([]);
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [storedAuditEvents, storedSnapshots] = await Promise.all([localDb.listAuditEvents(), localDb.listSnapshots()]);
      setAuditEvents(storedAuditEvents);
      setSnapshots(storedSnapshots);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Falha ao carregar a inspeção local.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const latestAuditEvent = auditEvents[0]?.timestamp ?? null;
    const latestSnapshot = snapshots[0]?.createdAt ?? null;

    return {
      auditEvents: auditEvents.length,
      snapshots: snapshots.length,
      latestAuditEvent,
      latestSnapshot,
    };
  }, [auditEvents, snapshots]);

  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary">Inspeção local</Badge>
            <CardTitle>Auditoria e snapshots persistidos no navegador</CardTitle>
            <CardDescription className="max-w-3xl leading-6">
              Painel simples para debug manual do fluxo local-first. Aqui você consegue verificar o que foi gravado em
              <code className="mx-1 rounded bg-background px-1.5 py-0.5 text-xs text-foreground">audit_events</code>
              e
              <code className="mx-1 rounded bg-background px-1.5 py-0.5 text-xs text-foreground">snapshots</code>
              sem backend remoto.
            </CardDescription>
          </div>

          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> {loading ? "Atualizando..." : "Atualizar inspeção"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Eventos auditáveis" value={String(summary.auditEvents)} icon={<Activity className="h-4 w-4" />} />
          <SummaryCard label="Snapshots locais" value={String(summary.snapshots)} icon={<Database className="h-4 w-4" />} />
          <SummaryCard
            label="Último evento"
            value={summary.latestAuditEvent ? formatDateTime(summary.latestAuditEvent) : "Nenhum"}
            icon={<Eye className="h-4 w-4" />}
          />
          <SummaryCard
            label="Último snapshot"
            value={summary.latestSnapshot ? formatDateTime(summary.latestSnapshot) : "Nenhum"}
            icon={<FileSearch className="h-4 w-4" />}
          />
        </div>

        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <Badge>audit_events</Badge>
            <CardTitle className="text-lg">Eventos de auditoria locais</CardTitle>
            <CardDescription>Timestamp, tipo, origem, aggregate id, refs e metadata útil para investigar o fluxo.</CardDescription>
          </div>

          {auditEvents.length > 0 ? (
            <div className="space-y-3">
              {auditEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-background/70 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{event.message}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusBadgeVariant(event.status)}>{event.status}</Badge>
                      <Badge variant="outline">{event.kind}</Badge>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <MetaItem label="ID do evento" value={event.id} />
                    <MetaItem label="Aggregate type" value={event.aggregateType} />
                    <MetaItem label="Aggregate id" value={event.aggregateId} />
                    <MetaItem label="Refs" value={event.refs?.length ? event.refs.join(", ") : "—"} />
                  </dl>

                  {event.metadata ? (
                    <pre className="mt-4 overflow-x-auto rounded-2xl border border-border/70 bg-card/60 p-3 text-xs text-slate-200">
                      {formatJsonPreview(event.metadata)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum evento encontrado"
              description="Gere uma simulação local ou processe um documento para popular a trilha de auditoria."
            />
          )}
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <Badge variant="secondary">snapshots</Badge>
            <CardTitle className="text-lg">Snapshots locais</CardTitle>
            <CardDescription>Inspeção rápida de escopo, entity id, momento da captura e payload persistido.</CardDescription>
          </div>

          {snapshots.length > 0 ? (
            <div className="space-y-3">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-2xl border border-border bg-background/70 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">Snapshot de {formatScopeLabel(snapshot.scope)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(snapshot.createdAt)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{formatScopeLabel(snapshot.scope)}</Badge>
                      {snapshot.localOnly ? <Badge variant="outline">local-only</Badge> : null}
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <MetaItem label="Snapshot id" value={snapshot.id} />
                    <MetaItem label="Entity id" value={snapshot.entityId ?? "—"} />
                    <MetaItem label="Scope" value={snapshot.scope} />
                    <MetaItem label="Persistência" value={snapshot.localOnly ? "Somente local" : "n/d"} />
                  </dl>

                  <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-border/70 bg-card/60 p-3 text-xs text-slate-200">
                    {formatJsonPreview(snapshot.payload)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum snapshot encontrado"
              description="Salve perfil, documentos ou simulações para gerar snapshots locais persistidos."
            />
          )}
        </Card>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="uppercase tracking-wide">{label}</dt>
      <dd className="break-all text-foreground">{value}</dd>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/40 p-5 text-sm">
      <div className="font-medium text-foreground">{title}</div>
      <p className="mt-2 leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
