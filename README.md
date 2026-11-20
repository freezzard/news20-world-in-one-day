# news20-world-in-one-day

make.fun competition `news-image-20261120`: one image summing up the world
news of Friday 20 November 2026.

`main.ts` (Node 22, standard library only) draws the whole digest with a
tiny rasterizer — masthead, lead story, 12 illustrated news cards, a
dot-matrix world map with pins, a day-in-numbers strip and 22 numbered
briefs — then writes a deterministic PNG to `/output/entry.png` with a
hand-rolled encoder. Two runs are byte-identical.

Run it: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

35 stories, all first reported on 20 November 2026 (Reuters, BBC, AP,
The Hindu, Space.com): Trump pushes the Iran war decision to 2027; the
Trump–Xi–Putin three-way summit in Shenzhen; the ICJ genocide ruling on
Myanmar; Cyclone Akvan; Voyager 1 at one light-day; Hayabusa2; the Riyadh
tower attack; Europe–Russia talks; GTA 6; Anthropic's debut; and more.
