import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { MapaCalculatedItem, MapaProduct } from "@/lib/price-mapa/types";
import { formatBRL } from "@/lib/price-comparativos-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GraficosMapaProps {
  items: MapaCalculatedItem[];
  anchors: MapaProduct[];
}

export function GraficosMapa({ items, anchors }: GraficosMapaProps) {
  // Data for price comparison bar chart
  const barData = anchors.map(anchor => {
    const data: any = { name: anchor.nome, Newline: anchor.preco_normalizado };
    const comps = items.filter(i => i.base_product_id === anchor.id);
    comps.forEach(c => {
      data[c.marca] = c.preco_simulado;
    });
    return data;
  });

  // Extract unique brands for coloring
  const brands = Array.from(new Set(items.map(i => i.marca)));
  const brandColors: Record<string, string> = {
    'Newline': '#D4AF37',
    'Interlight': '#3B82F6',
    'Usina': '#8B5CF6',
    'Perfil & LED': '#10B981',
    'Spotline': '#F59E0B',
    'Astraled': '#EF4444',
    'Nordecor': '#6366F1'
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0A0A0A] border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="text-xs font-medium text-white mb-2 uppercase tracking-wider">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs py-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="text-white font-medium">{formatBRL(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="surface border-white/5">
        <CardHeader>
          <CardTitle className="text-sm font-light uppercase tracking-widest flex items-center gap-2">
            <div className="h-1 w-3 bg-nl-gold" /> Comparativo de Preços (R$/m)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#888888" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Newline" fill={brandColors['Newline']} radius={[4, 4, 0, 0]} barSize={20} />
                {brands.map(brand => (
                  <Bar 
                    key={brand} 
                    dataKey={brand} 
                    fill={brandColors[brand] || '#ffffff20'} 
                    radius={[4, 4, 0, 0]} 
                    barSize={20} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="surface border-white/5">
        <CardHeader>
          <CardTitle className="text-sm font-light uppercase tracking-widest flex items-center gap-2">
            <div className="h-1 w-3 bg-blue-500" /> Dispersão: Preço x Diferença %
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                <XAxis 
                  type="number" 
                  dataKey="preco" 
                  name="Preço" 
                  unit="R$" 
                  stroke="#888888" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  type="number" 
                  dataKey="diff" 
                  name="Diferença" 
                  unit="%" 
                  stroke="#888888" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis type="number" range={[60, 60]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0A0A0A] border border-white/10 p-3 rounded-lg shadow-xl text-xs">
                          <p className="text-white font-medium mb-1">{data.nome}</p>
                          <p className="text-nl-gold">{data.marca}</p>
                          <div className="mt-2 space-y-1">
                            <p className="text-muted-foreground">Preço: <span className="text-white">{formatBRL(data.preco)}</span></p>
                            <p className="text-muted-foreground">Diferença: <span className={data.diff > 0 ? "text-destructive" : "text-emerald-500"}>{data.diff.toFixed(1)}%</span></p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {brands.map(brand => (
                  <Scatter 
                    key={brand} 
                    name={brand} 
                    data={items.filter(i => i.marca === brand).map(i => ({
                      preco: i.preco_simulado,
                      diff: i.diff_percentual,
                      nome: i.nome,
                      marca: i.marca
                    }))} 
                    fill={brandColors[brand] || '#ffffff20'} 
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
