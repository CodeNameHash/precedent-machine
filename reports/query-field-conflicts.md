# Query field conflicts — Class-1 audit (r10b)

Deal-level fields where cards of one family carry DIFFERENT values.
The query engine now reconciles deterministically (majority of
evidence-backed values — lib/query/executors/shared.js), but these are
the underlying data items to fix at the source. Generated from the
production corpus, 2026-07-19.


## effortsStandard [ANTITRUST_REGULATORY]

- **00d49e6a-3a99-4164-8417-76bf2713a3ec**
  - `REASONABLE_BEST_EFFORTS` ← ANTI-BURDEN, ANTI-EFFORTS, ANTI-INFO, ANTI-LITIGATION
  - `COMMERCIALLY_REASONABLE_EFFORTS` ← ANTI-EFFORTS
- **1e4b7102-7890-451a-b8d0-8357120fc371**
  - `REASONABLE_BEST_EFFORTS` ← ANTI-BURDEN, ANTI-EFFORTS
  - `COMMERCIALLY_REASONABLE_EFFORTS` ← ANTI-EFFORTS
- **320a3899-0d74-42d6-a412-3a962997d6ca**
  - `COMMERCIALLY_REASONABLE_EFFORTS` ← ANTI-EFFORTS
  - `REASONABLE_BEST_EFFORTS` ← ANTI-EFFORTS
- **555579a6-6a11-45b3-9da9-43e1b49a6e89**
  - `HELL_OR_HIGH_WATER` ← ANTI-BURDEN
  - `REASONABLE_BEST_EFFORTS` ← ANTI-EFFORTS
- **885edae5-49e8-464a-9f33-edd229119d7c**
  - `REASONABLE_BEST_EFFORTS` ← ANTI-EFFORTS, ANTI-FOREIGN, ANTI-INFO
  - `COMMERCIALLY_REASONABLE_EFFORTS` ← ANTI-EFFORTS
  - `FLAT` ← ANTI-EFFORTS
- **af4940e1-a645-437c-acfa-4a53e8d9f7ac**
  - `REASONABLE_EFFORTS` ← ANTI-EFFORTS, ANTI-INFO
  - `REASONABLE_BEST_EFFORTS` ← ANTI-EFFORTS
- **bb5f062d-2818-4f9f-b968-ad9980445b6f**
  - `COMMERCIALLY_REASONABLE_EFFORTS` ← Information to Regulators
  - `FLAT` ← Antitrust / Regulatory Efforts
- **c7c16365-c9cf-4bfb-93a6-1575084d717c**
  - `REASONABLE_BEST_EFFORTS` ← Stock Exchange Listing Covenant
  - `FLAT` ← ANTI-EFFORTS
- **ce061fd0-a437-4d20-8a84-fdd6296aa5a0**
  - `REASONABLE_EFFORTS` ← ANTI-INFO
  - `REASONABLE_BEST_EFFORTS` ← ANTI-EFFORTS
- **dc042001-b987-404f-bd02-41e1939fb914**
  - `BEST_EFFORTS` ← ANTI-BURDEN, ANTI-EFFORTS, ANTI-LITIGATION
  - `REASONABLE_BEST_EFFORTS` ← ANTI-INFO

(10 deals with conflicts)

## governingLaw [MISC_BOILERPLATE]

- **00d49e6a-3a99-4164-8417-76bf2713a3ec**
  - `DELAWARE` ← MISC-JURISD
  - `SPLIT_FINANCING` ← Financing Source Protections
- **0a043659-68fb-4d20-98e6-b926aa758799**
  - `DELAWARE` ← MISC-GOVLAW
  - `NEW_YORK` ← Unclassified
- **0d38cc1f-2f49-47ee-bc21-de68d7884b90**
  - `SPLIT_FINANCING` ← Financing Sources
  - `DELAWARE` ← MISC-GOVLAW
- **1e4b7102-7890-451a-b8d0-8357120fc371**
  - `FOREIGN` ← Certain Financing Provisions
  - `DELAWARE` ← MISC-SEVER
- **1f80bec7-294b-4590-b861-2c156e75aadc**
  - `SPLIT_FINANCING` ← Financing Sources
  - `DELAWARE` ← MISC-GOVLAW
- **4f015417-0845-406a-b6ea-e606faf37e46**
  - `DELAWARE` ← MISC-GOVLAW
  - `SPLIT_FINANCING` ← MISC-SPECIFIC
- **8cd0787f-4ca0-40fe-aebf-6f88c0b101da**
  - `SPLIT_FINANCING` ← Financing Provisions
  - `DELAWARE` ← MISC-GOVLAW
- **a1b07312-5ab1-4d6e-b173-6eccb5173d36**
  - `DELAWARE` ← Unclassified — Governing Law
  - `SPLIT_FINANCING` ← Unclassified — Financing Provisions
- **af4940e1-a645-437c-acfa-4a53e8d9f7ac**
  - `SPLIT_FINANCING` ← Debt Financing Sources
  - `DELAWARE` ← MISC-GOVLAW
- **bf31d586-c0bc-4ed2-8d46-e69451a05756**
  - `DELAWARE` ← MISC-GOVLAW
  - `SPLIT_FINANCING` ← Debt Financing Sources
- **fc03e7e3-e9ca-4936-bb9a-282a6276783a**
  - `DELAWARE` ← Unclassified — Governing Law
  - `SPLIT_FINANCING` ← Unclassified — Debt Financing Sources

(11 deals with conflicts)

## consultationTier [ANTITRUST_REGULATORY]

- **00d49e6a-3a99-4164-8417-76bf2713a3ec**
  - `CONSENT_NOT_UNREASONABLE` ← ANTI-CONSULT
  - `PARTICIPATE` ← ANTI-COOPERATE
  - `NOTICE_CONSULT` ← ANTI-COOPERATE
- **0d38cc1f-2f49-47ee-bc21-de68d7884b90**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-CONSULT
- **13894e33-b5b6-4412-96bb-940b841d5130**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **1e4b7102-7890-451a-b8d0-8357120fc371**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **1f80bec7-294b-4590-b861-2c156e75aadc**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `NOTICE_CONSULT` ← ANTI-COOPERATE, ANTI-INFO, ANTI-NOTIFY
- **2c143f44-6aa9-40d9-a92f-30d48aa603fd**
  - `GOOD_FAITH_VIEWS` ← ANTI-CONSULT
  - `PARTICIPATE` ← ANTI-COOPERATE
  - `CONSENT_SOLE` ← ANTI-INTERIM
- **320a3899-0d74-42d6-a412-3a962997d6ca**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **4f015417-0845-406a-b6ea-e606faf37e46**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `CONSENT_SOLE` ← ANTI-COOPERATE
- **555579a6-6a11-45b3-9da9-43e1b49a6e89**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **86a01770-f565-47c5-8e7d-2a75a66b5e8b**
  - `GOOD_FAITH_VIEWS` ← ANTI-CONSULT
  - `NOTICE_CONSULT` ← ANTI-COOPERATE, ANTI-FOREIGN
- **885edae5-49e8-464a-9f33-edd229119d7c**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **8cd0787f-4ca0-40fe-aebf-6f88c0b101da**
  - `CONSENT_NOT_UNREASONABLE` ← Timing Agreements
  - `PARTICIPATE` ← ANTI-CONSULT, ANTI-NOTIFY
- **a267309a-fc22-4160-a652-1144fc64e9cf**
  - `GOOD_FAITH_VIEWS` ← ANTI-CONSULT, ANTI-COOPERATE
  - `CONSENT_SOLE` ← ANTI-COOPERATE
  - `PARTICIPATE` ← ANTI-COOPERATE
- **af4940e1-a645-437c-acfa-4a53e8d9f7ac**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **bb5f062d-2818-4f9f-b968-ad9980445b6f**
  - `GOOD_FAITH_VIEWS` ← Consultation Rights, Cooperation / Control, Timing Agreements
  - `PARTICIPATE` ← Consultation Rights
- **c34415ed-44f7-432f-8d7c-6464b0310239**
  - `GOOD_FAITH_VIEWS` ← ANTI-CONSULT, ANTI-INFO
  - `PARTICIPATE` ← ANTI-CONSULT
  - `CONSENT_SOLE` ← ANTI-COOPERATE
- **c750afb9-73fc-4043-a9d7-269506a6e00e**
  - `INCORPORATE_COMMENTS` ← ANTI-CONSULT
  - `GOOD_FAITH_VIEWS` ← ANTI-COOPERATE
- **c7c16365-c9cf-4bfb-93a6-1575084d717c**
  - `CONSENT_NOT_UNREASONABLE` ← Shareholder Litigation Defence / Settlement Control
  - `NOTICE_CONSULT` ← ANTI-CONSULT, ANTI-COOPERATE, ANTI-NOTIFY
  - `PARTICIPATE` ← ANTI-CONSULT
- **ce061fd0-a437-4d20-8a84-fdd6296aa5a0**
  - `GOOD_FAITH_VIEWS` ← ANTI-CONSULT, ANTI-COOPERATE
  - `NOTICE_CONSULT` ← ANTI-COOPERATE, ANTI-NOTIFY
- **cf32899a-37c6-4147-8350-4a2e132a30db**
  - `PARTICIPATE` ← ANTI-CONSULT
  - `NOTICE_CONSULT` ← ANTI-CONSULT

(20 deals with conflicts)

## changeRecStandard [COVENANT_NO_SOLICITATION]

- **13894e33-b5b6-4412-96bb-940b841d5130**
  - `the failure to make such disclosure would be reasonably like` ← NOSOL-RECOMMEND
  - `that failure to do so would be reasonably likely to be incon` ← NOSOL-EXCEPT
- **1dfb11d5-99d3-4f2b-8229-6e61e8af2eea**
  - `would be inconsistent with its fiduciary duties under Applic` ← NOSOL-RECOMMEND
  - `inconsistent with the directors' fiduciary duties under Appl` ← NOSOL-RECOMMEND
  - `the failure to make such Adverse Recommendation Change would` ← NOSOL-INTERVENING, NOSOL-MATCH
  - `as would permit the Special Committee (or the Company Board,` ← NOSOL-NEGOTIATE
- **2b9a6571-6fe7-4aac-931d-a96ab227ea43**
  - `the failure to make such Adverse Recommendation Change would` ← NOSOL-INTERVENING
  - `the failure to make such Adverse Recommendation Change or to` ← NOSOL-REMATCH
- **320a3899-0d74-42d6-a412-3a962997d6ca**
  - `would reasonably be expected to be inconsistent with its fid` ← NOSOL-RECOMMEND
  - `the failure to make a Change of Board Recommendation would r` ← NOSOL-MATCH
- **448e524f-19b0-4b5c-837b-7d5cabbc0fb0**
  - `the board of directors of the Company determines in good fai` ← NOSOL-RECOMMEND
  - `failure to take such action would reasonably be expected to ` ← NOSOL-EXCEPT
- **555579a6-6a11-45b3-9da9-43e1b49a6e89**
  - `would reasonably be expected to be inconsistent with its fid` ← NOSOL-RECOMMEND
  - `would reasonably be expected to be inconsistent with the Com` ← NOSOL-INTERVENING
- **a267309a-fc22-4160-a652-1144fc64e9cf**
  - `failure to effect a Parent Change of Recommendation in respo` ← NOSOL-INTERVENING, NOSOL-RECOMMEND
  - `failure to effect a Company Change of Recommendation in resp` ← NOSOL-RECOMMEND
  - `failure to take such action would be inconsistent with the f` ← NOSOL-EXCEPT
- **aad132ee-8a43-436d-b6a8-5604b7dfee01**
  - `the failure to do so would reasonably be expected to be inco` ← NOSOL-INTERVENING
  - `the failure to make the Change in Recommendation or terminat` ← NOSOL-MATCH
- **c750afb9-73fc-4043-a9d7-269506a6e00e**
  - `the failure to do so would be inconsistent with its duties u` ← NOSOL-RECOMMEND
  - `the failure to do so would be reasonably likely to be incons` ← NOSOL-INTERVENING
- **cf32899a-37c6-4147-8350-4a2e132a30db**
  - `would be inconsistent with the Company Board's fiduciary dut` ← NOSOL-EXCEPT
  - `failure to take such action would be inconsistent with the C` ← NOSOL-INTERVENING

(10 deals with conflicts)
