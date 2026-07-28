import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getInventoryDemandForecast,
  getConsumptionByPackage,
} from "@/lib/entitlements.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

type Fc = {
  item_id: string;
  name_en: string;
  category: string;
  stock_qty: number;
  reorder_level: number;
  undelivered: number;
  shortfall: number;
};

type Cs = {
  plan_name: string;
  item_name: string;
  category: string;
  entitled: number;
  delivered: number;
};

export function InventoryInsights() {
  const forecastFn = useServerFn(getInventoryDemandForecast);
  const consumeFn = useServerFn(getConsumptionByPackage);

  const { data: forecast = [] } = useQuery({
    queryKey: ["inv-forecast"],
    queryFn: () => forecastFn(),
  });
  const { data: consumption = [] } = useQuery({
    queryKey: ["inv-consumption"],
    queryFn: () => consumeFn(),
  });

  const shortfalls = (forecast as Fc[]).filter((f) => f.shortfall > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${shortfalls.length ? "text-destructive" : "text-muted-foreground"}`}
            />
            Demand forecast
          </CardTitle>
          <CardDescription>
            Sum of undelivered package entitlements for active patients vs. current stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Undelivered</TableHead>
                <TableHead>In stock</TableHead>
                <TableHead>Shortfall</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(forecast as Fc[]).map((f) => (
                <TableRow key={f.item_id}>
                  <TableCell>
                    <div className="font-medium">{f.name_en}</div>
                    <Badge variant="secondary" className="text-xs">
                      {f.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{f.undelivered}</TableCell>
                  <TableCell className="font-mono">{f.stock_qty}</TableCell>
                  <TableCell className="font-mono">
                    {f.shortfall > 0 ? (
                      <Badge variant="destructive">-{f.shortfall}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {forecast.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No active entitlements.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by package</CardTitle>
          <CardDescription>Delivered vs. entitled per plan × item.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Entitled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(consumption as Cs[]).map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.plan_name}</TableCell>
                  <TableCell>{c.item_name}</TableCell>
                  <TableCell className="font-mono">{c.delivered}</TableCell>
                  <TableCell className="font-mono">{c.entitled}</TableCell>
                </TableRow>
              ))}
              {consumption.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
