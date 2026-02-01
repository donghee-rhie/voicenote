import React, { useEffect, useState } from 'react';
import { MoreHorizontal, Plus, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { StatusBadge } from '../../components/StatusBadge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';
import { User, UserRole, UserStatus } from '@common/types';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    status: 'ACTIVE',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('user:list');
      if (result.success && result.data) {
        setUsers(result.data);
      } else {
        toast({
          title: '오류',
          description: result.error || '사용자 목록을 불러올 수 없습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '사용자 목록을 불러오는 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const result = await window.electronAPI.invoke('user:create', formData);
      if (result.success) {
        toast({
          title: '성공',
          description: '사용자가 생성되었습니다',
        });
        setShowCreateDialog(false);
        resetForm();
        loadUsers();
      } else {
        toast({
          title: '오류',
          description: result.error || '사용자 생성에 실패했습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '사용자 생성 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    try {
      const updateData = {
        name: formData.name,
        role: formData.role,
        status: formData.status,
      };
      const result = await window.electronAPI.invoke('user:update', selectedUser.id, updateData);
      if (result.success) {
        toast({
          title: '성공',
          description: '사용자 정보가 수정되었습니다',
        });
        setShowEditDialog(false);
        setSelectedUser(null);
        resetForm();
        loadUsers();
      } else {
        toast({
          title: '오류',
          description: result.error || '사용자 수정에 실패했습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '사용자 수정 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      const result = await window.electronAPI.invoke('user:delete', selectedUser.id);
      if (result.success) {
        toast({
          title: '성공',
          description: '사용자가 삭제되었습니다',
        });
        setShowDeleteDialog(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        toast({
          title: '오류',
          description: result.error || '사용자 삭제에 실패했습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '사용자 삭제 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (user: User, newStatus: UserStatus) => {
    try {
      const result = await window.electronAPI.invoke('user:update', user.id, { status: newStatus });
      if (result.success) {
        toast({
          title: '성공',
          description: '사용자 상태가 변경되었습니다',
        });
        loadUsers();
      } else {
        toast({
          title: '오류',
          description: result.error || '상태 변경에 실패했습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '상태 변경 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      status: 'ACTIVE',
    });
  };

  const getRoleBadgeColor = (role: UserRole): string => {
    switch (role) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'bg-blue-500 hover:bg-blue-500/80';
      default:
        return 'bg-gray-500 hover:bg-gray-500/80';
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case 'ADMIN':
        return '관리자';
      case 'SUPER_ADMIN':
        return '최고 관리자';
      default:
        return '사용자';
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>사용자 관리</CardTitle>
              <CardDescription>시스템 사용자를 관리합니다</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              사용자 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">등록된 사용자가 없습니다</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} />
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">메뉴 열기</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>작업</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            수정
                          </DropdownMenuItem>
                          {user.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(user, 'ACTIVE')}>
                              승인
                            </DropdownMenuItem>
                          )}
                          {user.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(user, 'INACTIVE')}>
                              거부
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(user)}
                            className="text-destructive"
                          >
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 추가</DialogTitle>
            <DialogDescription>새로운 사용자를 생성합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">역할</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">사용자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">상태</Label>
              <Select
                value={formData.status}
                onValueChange={(value: UserStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">활성</SelectItem>
                  <SelectItem value="PENDING">대기중</SelectItem>
                  <SelectItem value="INACTIVE">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              취소
            </Button>
            <Button onClick={handleCreate}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 수정</DialogTitle>
            <DialogDescription>사용자 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">이름</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">이메일</Label>
              <Input id="edit-email" value={formData.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">역할</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">사용자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">상태</Label>
              <Select
                value={formData.status}
                onValueChange={(value: UserStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">활성</SelectItem>
                  <SelectItem value="PENDING">대기중</SelectItem>
                  <SelectItem value="INACTIVE">비활성</SelectItem>
                  <SelectItem value="SUSPENDED">중단됨</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              취소
            </Button>
            <Button onClick={handleUpdate}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="text-sm">
                <span className="font-medium">이름:</span> {selectedUser.name}
              </p>
              <p className="text-sm">
                <span className="font-medium">이메일:</span> {selectedUser.email}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
