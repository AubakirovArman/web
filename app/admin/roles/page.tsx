'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface PermissionDef {
  key: string;
  label: string;
  group: string;
}
interface AppRole {
  id: string;
  name: string;
  permissions: string[];
  builtin?: boolean;
  description?: string;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; description: string; permissions: Set<string> }>({
    name: '',
    description: '',
    permissions: new Set(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось загрузить роли');
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const selected = roles.find((r) => r.id === selectedId) || null;
  const isAdmin = selected?.id === 'admin' || (creating === false && selected?.permissions.includes('*'));

  const openRole = (role: AppRole) => {
    setCreating(false);
    setSelectedId(role.id);
    setDraft({ name: role.name, description: role.description || '', permissions: new Set(role.permissions) });
  };
  const openCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setDraft({ name: '', description: '', permissions: new Set() });
  };
  const toggle = (key: string) =>
    setDraft((d) => {
      const next = new Set(d.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...d, permissions: next };
    });

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Укажите название роли');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        permissions: Array.from(draft.permissions),
      };
      const res = creating
        ? await fetch('/api/admin/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/roles/${encodeURIComponent(selectedId!)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      toast.success(creating ? 'Роль создана' : 'Роль сохранена. Пользователи получат права при следующем входе.');
      setRoles(data.roles || []);
      setCreating(false);
      setSelectedId(data.role?.id || selectedId);
      if (data.role) setDraft({ name: data.role.name, description: data.role.description || '', permissions: new Set(data.role.permissions) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || selected.builtin) return;
    if (!confirm(`Удалить роль «${selected.name}»?`)) return;
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось удалить');
      toast.success('Роль удалена');
      setRoles(data.roles || []);
      setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Роли</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Создать
          </Button>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
            </div>
          ) : (
            roles.map((role) => (
              <button
                key={role.id}
                onClick={() => openRole(role)}
                className={[
                  'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  selectedId === role.id && !creating ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
                ].join(' ')}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{role.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {role.permissions.includes('*') ? 'полный доступ' : `${role.permissions.length} прав`}
                  </span>
                </span>
                {role.builtin && <Badge variant="outline" className="shrink-0 text-[10px]">встроенная</Badge>}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {creating ? 'Новая роль' : selected ? `Роль: ${selected.name}` : 'Выберите роль или создайте новую'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(creating || selected) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Название</label>
                  <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Описание</label>
                  <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                </div>
              </div>

              {isAdmin ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  Роль «Администратор» имеет полный доступ ко всем разделам — права не ограничиваются.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Доступы — отметьте, что разрешено роли:</p>
                  {groups.map(([group, perms]) => (
                    <div key={group}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perms.map((p) => (
                          <label
                            key={p.key}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent/40"
                          >
                            <Checkbox checked={draft.permissions.has(p.key)} onCheckedChange={() => toggle(p.key)} />
                            <span>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 border-t pt-3">
                <Button onClick={save} disabled={saving || isAdmin}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  {creating ? 'Создать роль' : 'Сохранить'}
                </Button>
                {!creating && selected && !selected.builtin && (
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
                    <Trash2 className="mr-1 h-4 w-4" /> Удалить
                  </Button>
                )}
                {!creating && selected?.builtin && (
                  <span className="text-xs text-muted-foreground">Встроенную роль нельзя удалить</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
