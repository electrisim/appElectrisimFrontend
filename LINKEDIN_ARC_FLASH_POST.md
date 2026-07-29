# LinkedIn post — Arc Flash (IEEE 1584) in Electrisim

## Post body (paste into LinkedIn)

Most engineers can run a short-circuit study.

Far fewer can turn that number into a PPE decision.

That gap is where people get hurt.

An arc flash is not “just a big fault.” In milliseconds, the air ionizes, plasma jets toward the worker, and the incident energy at the working distance decides whether clothing protects you — or fails.

IEEE 1584-2018 is the industry method for quantifying that risk:
bolted fault current → arcing current → incident energy (cal/cm²) → arc-flash boundary → PPE category.

It accounts for electrode configuration (VCB, VCBB, HCB, VOA, HOA), enclosure size, conductor gap, working distance, and clearing time — including the reduced-arcing-current case that often produces the worst energy.

We just shipped Arc Flash analysis in Electrisim.

Draw your network once. Run a 3-phase max short-circuit. Electrisim applies IEEE 1584-2018 at every bus and paints incident energy, arc-flash boundary, and PPE category directly on the diagram. Buses above 15 kV fall back to the Ralph Lee method and are clearly flagged.

No separate spreadsheet. No re-entering fault currents by hand.

If you design, operate, or audit industrial and distribution systems: what clearing time do you assume when the TCC is still uncertain — and how do you document it?

#arcflash #electricalengineering #powersystems #IEEE1584 #electrisim

---

## First comment (post this immediately after publishing)

Try it in the browser: https://app.electrisim.com

Docs and product: https://electrisim.com

Tip: start with a simple LV MCC feeder (VCB, 455 mm working distance, your breaker clearing time). Compare Category results before/after changing clearing time — that single parameter often dominates PPE.

---

## Reach tips (do not put in the post)

1. Publish Tuesday–Thursday, ~08:00–10:00 local time for your main audience.
2. Attach a screenshot of Electrisim with Arc Flash result boxes on buses (IE, AFB, PPE) — native image, not a link preview.
3. Reply to every early comment in the first hour.
4. Keep the link only in the first comment (LinkedIn deprioritizes posts with links in the body).
5. Tag 2–3 relevant engineers or safety leads in comments only if you have a real relationship (no spray-tagging).
