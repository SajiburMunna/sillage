# Sillage Theme Redesign — Research & Design Plan

Nov 11, 2026 · Living version: [Claude doc](https://claude.ai/artifact/RTwXXkKrV5k4oEca6atJBd)

## Status (Nov 12, 2026)

All five build phases are coded; Theme Check reports 0 errors and 0 warnings across 138 files. What remains needs the live store or the owner.

| Phase | Code | Still to do |
| --- | --- | --- |
| 1 · Foundation | Done | Confirm fonts render on the store |
| 2 · Home page | Done | Owner review on an unpublished theme |
| 3 · Shopping pages | Done | Lighthouse 60+ performance, 90+ accessibility on home, collection, product |
| 4 · Supporting pages | Done | Accessibility checklist run on the store |
| 5 · Launch | Presets Sillage, Linger, Veloura with `/listings` templates; header polish; icon set redrawn by hand, sparkle removed | Real documentation and support URLs in `theme_info`; three demo stores with original photography and copy; submission |

## Goals

Sillage gets a completely new look: a premium, sellable Shopify theme for fragrance, beauty and small-batch luxury brands. The current visual design is retired; the working code underneath (cart, filters, quick view, zoom, translations) is kept and restyled.

**What the three words mean in practice**

- **Unique:** a signature visual idea a shopper remembers after one visit, not a reskinned Dawn layout.
- **Posh:** restraint. Generous space, fine lines, a quiet palette, large serif type and real photography carry the luxury, not effects.
- **Smooth:** every state change animates with intent, nothing jumps, nothing loads blank, and it stays fast on a mid-range phone.

**Who it is for**

- **The merchant** buying the theme: a fragrance, skincare, candle or jewellery brand selling 10 to 300 products, often with samples, subscriptions and gift sets.
- **Their shopper:** mostly on a phone, browsing slowly, deciding by scent notes, reviews and the feel of the brand.

**How we judge success**

| Measure | Target |
| --- | --- |
| Shopify Theme Check | 0 errors, 0 warnings |
| Lighthouse performance, mobile | 60 or higher on home, collection and product (Theme Store minimum) |
| Lighthouse accessibility | 90 or higher on every template (Theme Store minimum) |
| Contrast | 4.5:1 for all text, 3:1 for icons and borders |
| Tap targets | 44 × 44 px minimum |
| Layout shift (CLS) | Below 0.1 |
| Owner review | Looks premium enough to pay for, on desktop and phone |

## Shopify research

To be accepted and sell, the theme must look fundamentally different from every Theme Store theme, not just recoloured, and pass hard performance and accessibility gates ([Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements)).

**Gates we must pass**

| Area | Requirement |
| --- | --- |
| Performance | Lighthouse average 60 or higher on home, collection and product, desktop and mobile, tested with real images |
| Accessibility | Lighthouse average 90 or higher on the same pages; 4.5:1 text contrast, 3:1 for large text, borders and icons |
| Keyboard | Every part reachable by keyboard, visible focus, focus order follows the page |
| Uniqueness | Real design and functional innovation; spacing, colour, font, shadow or animation changes alone do not count |
| Not reproducible | A merchant must not be able to recreate another Theme Store theme through settings |
| Art direction | Clear systems for header and navigation, product cards, media treatment and page structure |
| Codebase | Original code or Shopify's Skeleton theme only; nothing derived from Dawn or Horizon |
| Audience | Clearly aimed at one merchant type: ours is fragrance and luxury beauty |
| Presets | 1 to 2 word names under 30 characters, each with its own demo store and templates in a `/listings` folder |
| Fonts | Font picker only, with bold, italic and bold-italic loaded through `font_modify` |

**Where Sillage stands today**

- **Already in place:** sections everywhere, app blocks, faceted filtering, gift card recipient form, Shop Pay Installments, complementary products, pickup availability, 3D and video media, unit prices, selling plans, predictive search, multi-level menus, three presets, original code.
- **Missing, must add:** a Follow on Shop button (the `login_button` filter) and the `<shopify-account>` component in the desktop and mobile header.
- **To check during the build:** gift card QR code at least 120 × 120 px, Apple Wallet link, the `/listings` folder per preset, and settings copy in sentence case without ampersands.

**What premium paid themes do that free ones do not**

- **A recognisable signature:** one layout or motion idea repeated across pages, so the store is identifiable from a screenshot.
- **Merchandising tools:** tabbed product rails, shoppable images, product spotlights, comparison and "complete the set" blocks.
- **Calm, fast interaction:** drawers and quick add instead of page reloads, skeleton loading, no layout jumps.
- **Industry-specific sections:** for fragrance, a notes pyramid, scent families, a scent finder quiz and discovery sets, all of which Sillage already has code for.

## Luxury storefront research

Beauty is the second most visually driven shopping category after apparel, and luxury sites lose shoppers most on search, filters and missing delivery or returns information ([Baymard health and beauty](https://baymard.com/blog/health-and-beauty-ux-research), [Baymard luxury pitfalls](https://baymard.com/blog/2021-luxury-ecommerce-benchmark)). The design must make products desirable and still answer practical questions fast.

**What the research says, and what we build for it**

| Finding | Source | Our response |
| --- | --- | --- |
| Shoppers who cannot try the product rely on images; cut-out packshots alone lose them | Baymard, health and beauty | Every product supports lifestyle and in-context media; cards swap to a second image on hover; full-screen zoom |
| Fancy shade or scent names say nothing about the product | Baymard, health and beauty | Notes pyramid (top, heart, base) and scent family shown on cards and product pages |
| Reviewer details matter more than stars | Baymard, health and beauty | Rating on cards; reviews app block slot on the product page |
| Free samples shown in the cart feel like a reward | Baymard, health and beauty | Free-sample line and discovery-set upsell in the cart drawer |
| No overview of applied filters; no match counts | Baymard, luxury pitfalls 9 and 10 | Removable filter chips and counts on every option (already built) |
| Temporarily sold-out items cannot be ordered; 30% would likely leave | Baymard, luxury pitfall 11 | "Notify me" and restock wording on sold-out variants |
| No estimated delivery date near the buy button | Baymard, luxury pitfall 12 | Delivery estimate block next to Add to bag |
| No returns or shipping links in the footer | Baymard, luxury pitfall 2 | Dedicated "Client care" footer column |
| Current scope not highlighted in mobile navigation | Baymard, luxury pitfall 14 | Active state in menus plus breadcrumbs (breadcrumbs already built) |
| Hit areas too small on phones | Baymard, luxury pitfall 15 | 44 px minimum targets everywhere |

**Patterns that make a store feel expensive**

- **Space as a material:** wide margins, few elements per screen, one idea per section.
- **Editorial type:** a large serif display face at real scale, with a quiet sans for reading and small caps labels.
- **Real photography in consistent frames:** one crop system and one frame shape across the site.
- **Slow, physical motion:** content eases in on scroll; images settle rather than snap.
- **Service language:** samples, gift wrap, engraving and complimentary delivery presented as hospitality, not discounts.

**Anti-patterns to avoid** (UI/UX skill guidance plus research)

- Pop-ups before the shopper has scrolled, countdown timers and flashing sale badges.
- Infinite decorative animation; the skill flags this as distracting and reserves it for loading indicators.
- Auto-rotating carousels without pause controls.
- Glassmorphism and neon effects; the skill's generic luxury suggestion ("Liquid Glass") suits app chrome, not a fragrance boutique.
- Emoji or clip-art icons; one consistent SVG icon set only.

## Design concept: "The Trail"

The new Sillage is built on its own name: *sillage* is the trail a fragrance leaves behind. Every page is staged like a quiet perfume boutique, and four signature devices make it recognisable from a single screenshot.

**The four signatures**

1. **The trail line.** One hairline curve runs down the home page, linking section numbers like a scent drifting through a room. It draws itself as you scroll, and stays still for visitors who prefer reduced motion.
2. **The vessel frame.** All key media sit in one shape: a tall arch with softened shoulders, like a bottle's silhouette. Hero, collection tiles, spotlight and product gallery share it, so the store reads as one system.
3. **Scent tint.** Each product and collection can carry its own tint colour (a metafield). Cards glow faintly in that tint on hover, and the product page takes on a soft ambient gradient of it. No other theme does this, and it is functional: shoppers sense the mood of a scent before reading.
4. **Note chips.** Small pill labels name the notes (Bergamot, Iris, Oud). They appear on the hero, cards, quick view and product page, and link to filtered collections.

**Mood**

- **Light:** warm paper white, morning light, soft shadows; never pure white or pure black.
- **Material:** glass, linen, travertine, brushed brass.
- **Type:** a large high-contrast serif for display, a calm humanist sans for reading, small caps with wide spacing for labels.
- **Pace:** slow and deliberate. One idea per screen, generous space, motion that settles.

**What it is not**

- Not a fashion grid of tiny tiles, not a discount store, not glassmorphism or neon.
- Not reproducible by recolouring another theme: the trail, the vessel frame and scent tint are structural, which meets Shopify's uniqueness rule.

## Design system

Five warm colour schemes, one serif and sans pairing, an 8 px spacing rhythm and a small set of motion tokens make up the whole system; every value below is a theme setting or a CSS token, never a one-off.

**Colour schemes** (contrast checked against WCAG; lowest text pair is 5.6:1)

| Scheme | Background | Text | Accent | Text contrast | Accent contrast | Used for |
| --- | --- | --- | --- | --- | --- | --- |
| Paper | #F6F2EC | #1E1A17 | #8A5235 cognac | 15.5:1 | 5.6:1 | Default pages |
| Linen | #EBE3D7 | #1E1A17 | #7E4A30 | 13.6:1 | 5.7:1 | Alternating bands, cards |
| Porcelain | #FFFFFF | #1E1A17 | #8A5235 | 17.3:1 | 6.3:1 | Product photography, cart |
| Ink | #17130F | #F3EDE4 | #D6B086 brass | 15.9:1 | 9.2:1 | Hero, closing banner, footer |
| Fig | #3A2330 | #F5EAE5 | #E9B9A6 blush | 12.2:1 | 8.2:1 | Spotlight, gift features |

Muted text is the text colour at 70% opacity and still reaches 5.7:1 or more on every scheme. Scent tint is set per product and only ever tints backgrounds, never text.

**Typography** (Shopify font library; availability confirmed in the theme editor before build)

| Role | Font | Size | Notes |
| --- | --- | --- | --- |
| Display | Cormorant, weight 500 | 56 to 150 px fluid | Tight leading 0.95, slight negative tracking |
| Heading | Cormorant, weight 500 | 24 to 56 px fluid | Balanced line breaks |
| Body | Jost, weight 400 | 16 px, line height 1.6 | Fallback: Montserrat |
| Label | Jost, weight 500, uppercase | 12 px, tracking 0.2em | Eyebrows, vendor, chips |
| Price and numbers | Jost, tabular figures | 15 to 22 px | Digits never jump when prices change |

**Spacing, shape and depth**

| Token | Values |
| --- | --- |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px |
| Section rhythm | 96 px desktop, 64 px mobile; 128 px around hero and closing banner |
| Page width | 1440 px max, 16 to 40 px side gutter |
| Vessel frame | Arch top radius 50% of width, 4 px base corners |
| Corners | Buttons pill, cards 4 px, inputs 4 px |
| Shadows | Three warm-tinted levels: small for chips, medium for drawers, large for floating panels |
| Lines | 1 px hairlines at 12% text colour |

**Icons:** one hand-drawn 1.3 px stroke set on a 24 px grid (35 icons already in the theme), always paired with text or a hidden label.

**Motion tokens**

| Token | Value | Use |
| --- | --- | --- |
| Fast | 180 ms | Hover colours, focus |
| Base | 300 ms | Buttons, chips, tabs |
| Slow | 600 ms | Drawers, image swaps |
| Reveal | 1100 ms | Content entering on scroll |
| Ease out | cubic-bezier(0.22, 1, 0.36, 1) | Things arriving |
| Ease in | cubic-bezier(0.4, 0, 1, 1) | Things leaving, shorter than arriving |

## Page architecture

The home page tells the brand story in ten numbered chapters joined by the trail line; every other page puts the product first and keeps the same frame, type and motion.

**Home page running order:** ten chapters, each one screen of story.

1. Editorial hero
2. Scrolling promise ribbon
3. Scent families
4. Bestsellers in tabs
5. Product spotlight with notes
6. The ritual, in steps
7. Discovery set offer
8. Press quotes
9. Worn by you gallery
10. Closing banner with newsletter

**Other pages**

| Page | Layout, top to bottom | What changes from today |
| --- | --- | --- |
| Header | Announcement bar · logo centred · menu left · search, account (`<shopify-account>`), bag right · mega menu with a featured image | New mega menu art, account component, active-page marker |
| Collection | Breadcrumbs · title and description split · scent family chips · sticky toolbar · product grid with an editorial tile every 8 products · pagination | Family chips and in-grid editorial tile are new |
| Product | Vessel gallery with thumbnails · sticky info column: vendor, title, rating, price, note chips, size pills, purchase options, buy buttons, delivery estimate, trust row · notes pyramid · accordions · complementary products · reviews app slot · recently viewed | Scent tint background, note chips, delivery estimate, notify-me on sold out |
| Quick view | Gallery and buy box in a drawer | Restyled to the new system |
| Cart drawer | Free shipping bar · line items · free samples line · discovery set upsell · gift wrap · note · total and checkout | Samples line and upsell card are new |
| Search | Predictive drawer with products, collections and pages · results page with tabs for products and articles | New layout |
| Blog and article | Featured first article · grid · topic chips · article with reading time, pull quotes, related products | Reading time and related products are new |
| Footer | Large wordmark · newsletter · Shop, Client care, About columns · Follow on Shop · country and language · payment icons | Client care column and Follow on Shop are new |
| 404, password, gift card, account | Same frame and type, one clear next step on each | Restyled; gift card QR code at least 120 px |

## New section library

Ten new sections carry the redesign; each works with no content (tasteful placeholders), on every colour scheme, and from 320 px to 1920 px wide.

| Section | Purpose | Layout | Main settings | Blocks |
| --- | --- | --- | --- | --- |
| Editorial hero | First impression and the main call to action | Headline and buttons left; vessel-framed image right with a smaller overlapping image, floating note chips and a badge that turns as you scroll; rating proof under the buttons | Images (desktop, mobile), colour scheme, height, show trail start | Eyebrow, heading, text, buttons, rating line, note chip |
| Promise ribbon | Repeat key promises without shouting | One slow line of text and sparkle icons; pause button; still for reduced motion | Speed, direction, size (small or display), colour scheme | Item (text, icon) |
| Scent families | Browse by mood | Four tall vessel tiles in a row; swipe on phones; tint overlay, title, note words, product count, arrow | Columns, tile height, colour scheme | Family (collection, title, notes, image, tint) |
| Bestsellers in tabs | Merchandise several collections in one place | Pill tabs above a product grid; one tab visible at a time; View all link per tab | Products per tab, columns, colour scheme | Tab (collection, label) |
| Product spotlight | Sell one hero product in depth | Large vessel image on a tint field; notes pyramid; price, size select and Add to bag | Product, image override, layout side, colour scheme | None; notes come from product metafields or settings |
| The ritual | Explain how to wear or use | Sticky image on one side cross-fades as numbered steps scroll past; stacked on phones | Heading, image side, colour scheme | Step (title, text, image) |
| Discovery set offer | Turn browsers into first buyers | Dark band: vial row illustration or image, price, what is included, credit-back promise, button | Product, image, colour scheme | Included item |
| Press quotes | Borrowed authority | One large quote at a time; publication names as tabs beneath | Colour scheme | Quote (text, publication, logo) |
| Worn by you | Social proof with products | Five to eight photos in a staggered grid; each links to a product with name and price on hover | Heading, link to social profile, colour scheme | Photo (image, product, caption) |
| Closing banner | Last call to subscribe or shop | Ink band with a large headline, newsletter field, three perks with icons | Image, show newsletter, colour scheme | Perk (icon, text) |

**Already built and kept** (restyled to the new system): image banner, slideshow, multicolumn, image with text, featured product, collection list, testimonials, FAQ, video, rich text, scent quiz, store locations, countdown, promo pop-up, recently viewed, product recommendations.

**Retired from the default home page** (still available in the editor): the current scroll story, scent collection, scent house and scent visit sections.

## Interaction and motion

Smooth means three things here: nothing jumps, every action answers within 100 ms, and motion explains where something came from or went.

**Rules**

1. **Nothing jumps.** Every image reserves its space before it loads; fonts swap without reflow; drawers slide over content rather than pushing it.
2. **Instant answer.** A pressed button shows its pressed state at once and a spinner after 300 ms; prices, stock and images update in place.
3. **Arrive slow, leave fast.** Entrances use ease-out at 600 to 1100 ms; exits use ease-in at roughly two thirds of that.
4. **Animate only transform and opacity.** Never width, height or top, which stutter on phones.
5. **One moving thing at a time.** Scroll reveals are staggered by 80 ms; nothing loops forever except loading indicators.
6. **Respect the person.** Reduced-motion visitors get the final state with no movement; anything moving longer than five seconds has a pause button.

**Signature moments**

| Moment | What happens | Duration |
| --- | --- | --- |
| Page change | Old page fades up and out, new page settles in (native view transitions) | 350 ms out, 600 ms in |
| Trail line | Draws downward in step with scrolling; the next chapter number lights as it arrives | Tied to scroll |
| Section reveal | Content rises 32 px and fades in once, when 8% into view | 1100 ms |
| Card hover | Second image fades in, photo eases to 103.5% scale, action bar rises, tint glow appears | 600 ms image, 300 ms bar |
| Add to bag | Button shows a spinner, the bag count ticks, the cart drawer slides in with the new line highlighted | 500 ms drawer |
| Variant change | Price digits stay put (tabular figures), image cross-fades, stock dot updates | 300 ms |
| Drawers and quick view | Slide from the edge over a dimmed page; focus moves inside and returns on close | 500 ms in, 350 ms out |
| Zoom viewer | Opens full screen; tap to zoom toward the pointer; swipe between images | 450 ms |

**Loading states:** skeleton blocks in the vessel shape for quick view and predictive search; never a blank panel.

## Quality bar

Every phase ships only when it passes the checks below; the Lighthouse numbers are Shopify's own minimums, the rest are our stricter targets.

**Performance budget**

| Item | Budget |
| --- | --- |
| Lighthouse performance, mobile | 60+ (Shopify minimum), aim 75+ |
| Largest image paint (LCP) | Under 2.5 s on 4G |
| Layout shift (CLS) | Under 0.1 |
| Theme JavaScript | Under 60 KB compressed, deferred, no libraries |
| CSS on any page | Under 60 KB compressed; section CSS loads only with its section |
| Fonts | Two families, WOFF2, `font-display: swap`, the hero face preloaded |
| Images | Shopify CDN `srcset` everywhere; hero `fetchpriority=high`; everything below the fold lazy |

**Accessibility checklist**

- [ ] Lighthouse accessibility 90+ on home, collection and product, desktop and mobile
- [ ] Text contrast 4.5:1, large text, icons and borders 3:1, on all five schemes
- [ ] Every control works by keyboard with a visible focus ring; focus order follows the page
- [ ] Drawers, quick view and zoom trap focus, close on Escape and return focus
- [ ] Tap targets 44 px (Shopify requires 24 px)
- [ ] Carousels, ribbons and tabs follow WAI-ARIA patterns with pause controls
- [ ] All images have alt text; decorative ones are hidden from screen readers
- [ ] Reduced motion honoured everywhere

**Theme Store checklist**

- [ ] Theme Check: 0 errors, 0 warnings
- [ ] All required templates and features present, including Follow on Shop and `<shopify-account>`
- [ ] Every setting labelled, sentence case, no ampersands, verb-led buttons
- [ ] Fonts via font picker with bold, italic and bold-italic loaded
- [ ] Each preset has its own demo store and `/listings` templates
- [ ] Fresh install matches the demo

**How we verify each phase**

1. Theme Check after every change.
2. Static preview pages rendered in Chrome at 390, 768 and 1440 px, desktop and touch modes.
3. A push to an unpublished theme on the dev store, checked by the owner.
4. Lighthouse runs on the three key pages before a phase is called done.

## Build plan

The build runs in five phases, home page first, and no phase starts until the previous one passes its gate.

| Phase | Scope | Gate to pass before the next phase |
| --- | --- | --- |
| 1 · Foundation | Design tokens, five colour schemes, fonts, vessel frame, trail line; Follow on Shop button and account component in the header | Theme Check clean, fonts confirmed |
| 2 · Home page | Ten new sections and the new default home template; placeholders that look finished even with no content | Owner approves on the dev store |
| 3 · Shopping pages | Header, collection, product with scent tint and note chips; quick view and cart drawer with samples line and upsell | Lighthouse 60+ performance, 90+ accessibility |
| 4 · Supporting pages | Search, blog and article, footer, 404, password, gift card, account, restyled to the same frame, type and motion | Accessibility checklist complete |
| 5 · Launch | Three presets with listings templates and demo stores; original copy and photography, then Theme Store submission | Theme Store checklist complete |

Phase 2 is the first thing you will see on the dev store. Each phase ends with a push to an unpublished theme so you can review it before the next begins.

## Risks and open questions

The biggest risk is visual: without real photography the redesign cannot look premium, so imagery is the first thing to settle.

| Risk | Effect | Mitigation |
| --- | --- | --- |
| No lifestyle photography in the store yet | The design looks empty and Shopify rejects placeholder-heavy demos | Commission or license 15 to 20 images per preset before the demo store; use tasteful placeholders meanwhile |
| Cormorant or Jost missing from the Shopify font library | Typography falls back to other faces | Confirm in the theme editor in phase 1; fallbacks are Playfair Display and Montserrat |
| Trail line and scroll effects cost performance | Lighthouse below 60 on mobile | CSS scroll-driven animation only, no JavaScript loops; disabled on low-end devices and for reduced motion |
| Retiring the current home sections upsets existing setups | Merchants lose content on update | Old sections stay available in the editor; only the default template changes |
| Uniqueness judged too close to other themes | Theme Store rejection | Signatures are structural (trail, vessel frame, scent tint), documented in the submission |

**Open questions for the owner**

- [ ] Which three preset names and industries: for example fragrance, skincare, candles?
- [ ] Do we have, or can we buy, lifestyle and model photography for the demo stores?
- [ ] Keep the current scent quiz on the new home page, or link to it from the hero?
- [ ] Delivery estimate: a fixed range set in theme settings, or from an app?
- [ ] Target price for the theme on the Theme Store?
