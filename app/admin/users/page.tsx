'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, UserCog } from 'lucide-react';

type Role = 'applicant' | 'expert' | 'admin';
interface AppUser {
  id: string;
  username: string | null;
  displayName: string | null;
  role: Role;
  createdAt: string | null;
}

const roleLabels: Record<Role, string> = { applicant: 'Заявитель', expert: 'Эксперт', admin: 'Администратор' };
const roleVariant: Record<Role, 'default' | 'secondary' | 'outline'> = { admin: 'default', expert: 'secondary', applicant: 'outline' };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить пользователей');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (user: AppUser) => {
    if (!window.confirm(`Удалить пользователя «${user.username}»?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось удалить');
      toast.success('Пользователь удалён');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Пользователи</CardTitle>
            <p className="text-sm text-muted-foreground">Учётные записи и роли (хранятся в Postgres, пароли — scrypt).</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить пользователя
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-9 animate-pulse bg-muted" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Логин</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.displayName || '—'}</TableCell>
                    <TableCell><Badge variant={roleVariant[user.role]}>{roleLabels[user.role] || user.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-KZ') : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                          <UserCog className="mr-1 h-3.5 w-3.5" /> Изменить
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(user)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Пользователей нет.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && <UserDialog mode="create" onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <UserDialog mode="edit" user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UserDialog({ mode, user, onClose, onSaved }: { mode: 'create' | 'edit'; user?: AppUser; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [role, setRole] = useState<Role>(user?.role || 'applicant');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const url = mode === 'create' ? '/api/admin/users' : `/api/admin/users/${encodeURIComponent(user!.id)}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const payload = mode === 'create'
        ? { username, password, role, displayName }
        : { role, displayName, ...(password ? { password } : {}) };
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не удалось сохранить');
        return;
      }
      toast.success(mode === 'create' ? 'Пользователь создан' : 'Пользователь обновлён');
      onSaved();
    } catch {
      setError('Сеть недоступна');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Новый пользователь' : `Редактирование: ${user?.username}`}</DialogTitle>
          <DialogDescription>{mode === 'create' ? 'Логин, пароль и роль.' : 'Можно сменить роль, имя и задать новый пароль.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {mode === 'create' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Логин</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="например, expert2" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Отображаемое имя</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Имя Фамилия / должность" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Роль</label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="applicant">Заявитель</SelectItem>
                <SelectItem value="expert">Эксперт</SelectItem>
                <SelectItem value="admin">Администратор</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{mode === 'create' ? 'Пароль' : 'Новый пароль (необязательно)'}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'edit' ? 'оставьте пустым, чтобы не менять' : 'минимум 6 символов'} />
          </div>
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
