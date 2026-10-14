import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import './DealTicker.css';

export default function DealTicker() {
  const { data, isError } = useQuery({
    queryKey: ['public', 'deal-ticker'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('deal_ticker');
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
    refetchInterval: 60_000,
  });

  if (isError || !data?.length) return null;

  return (
    <section aria-labelledby="exclusive-deals-heading" className="aa-deal-ticker-section col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
      <h3 id="exclusive-deals-heading" className="aa-deal-ticker-heading font-serif text-2xl mb-8">EXCLUSIVE DEALS</h3>
      <div className="aa-deal-ticker-strip">
        <div className="aa-deal-ticker-track">
          {[false, true].map((duplicate) => (
            <ul key={String(duplicate)} className="aa-deal-ticker-list" aria-hidden={duplicate || undefined}>
              {data.map((deal, index) => (
                <li key={index} className="aa-deal-ticker-item">
                  <span className="section-label aa-deal-ticker-label">{deal.label}</span>
                  <span className="aa-deal-ticker-dot" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <p className="aa-deal-ticker-note">*More exclusive deals inside the Academy</p>
    </section>
  );
}