import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface Props<T extends { id: string; is_active?: boolean }> {
  title: string;
  description?: string;
  items: T[];
  isLoading?: boolean;
  columns: Column<T>[];
  searchFn: (row: T, query: string) => boolean;
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  canDelete?: boolean;
  addLabel?: string;
  emptyLabel?: string;
}

export function MasterDataList<T extends { id: string; is_active?: boolean }>({
  title,
  description,
  items,
  isLoading,
  columns,
  searchFn,
  onAdd,
  onEdit,
  onDelete,
  canDelete = true,
  addLabel = "Add",
  emptyLabel = "No records yet.",
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<T | null>(null);

  const filtered = query.trim()
    ? items.filter((r) => searchFn(r, query.trim().toLowerCase()))
    : items;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" /> {addLabel}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="pl-8"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c, i) => (
                    <TableHead key={i} className={c.className}>
                      {c.header}
                    </TableHead>
                  ))}
                  <TableHead className="w-24 text-right">Status</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground py-6">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground py-6">
                      {emptyLabel}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((c, i) => (
                      <TableCell key={i} className={c.className}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {row.is_active === false ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => onEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirming(row)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirming} onOpenChange={(v) => !v && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) onDelete(confirming);
                setConfirming(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
