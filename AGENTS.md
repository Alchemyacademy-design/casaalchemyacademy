# Architecture rules
- Use the shared WorkshopCover renderer for live workshop images so natural proportions and neutral loading placeholders remain consistent across pages.
- Share partner-deal cover/description rendering and member deal ordering so logos, phone links and Casa Consult priority stay consistent across deals views.
- Keep the public deals ticker isolated and sourced only from deal_ticker(), preserving server ordering and hiding unavailable data without exposing member deal records.- Individual course sales use one active one-off stripe_prices row per course (course_id set) read via get_individual_course_prices(); checkout and webhook never fall back to a generic course_id-null price, so courses without their own price stay unsellable.
