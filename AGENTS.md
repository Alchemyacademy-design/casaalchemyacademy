# Architecture rules
- Use the shared WorkshopCover renderer for live workshop images so natural proportions and neutral loading placeholders remain consistent across pages.
- Share partner-deal cover/description rendering and member deal ordering so logos, phone links and Casa Consult priority stay consistent across deals views.
- Keep the public deals ticker isolated and sourced only from deal_ticker(), preserving server ordering and hiding unavailable data without exposing member deal records.