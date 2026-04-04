/*
  # Add vibe_index recalculation with new formula + YouTube entry tracking

  ## Summary
  새로운 바이브 지수 공식을 적용하고, 클레임 등록 시점의 YouTube 통계를
  entry(기준값)으로 저장하는 컬럼을 추가합니다.

  ## New Formula
  vibe_index = (조회수 성장률 × 0.6 + 좋아요 성장률 × 0.4) × 100
  - 조회수/좋아요가 없으면 Spotify followers 성장률만 사용

  ## Changes

  ### Modified Tables
  - `claims`
    - `entry_youtube_view_count` (bigint, nullable): 클레임 등록 시 YouTube 조회수 기준값
    - `entry_youtube_like_count` (bigint, nullable): 클레임 등록 시 YouTube 좋아요 기준값

  ### New Functions
  - `calculate_vibe_index(claim_id uuid)`: 새 공식으로 vibe_index 재계산
  - `recalculate_all_vibe_indexes()`: 모든 클레임 일괄 재계산

  ## Notes
  - entry_youtube_* 컬럼은 youtube_view_count/youtube_like_count와 동일한 값으로 초기화
  - 기존 클레임의 vibe_index는 재계산 함수 호출 시 갱신됨
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'entry_youtube_view_count'
  ) THEN
    ALTER TABLE claims ADD COLUMN entry_youtube_view_count bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'entry_youtube_like_count'
  ) THEN
    ALTER TABLE claims ADD COLUMN entry_youtube_like_count bigint;
  END IF;
END $$;

UPDATE claims
SET
  entry_youtube_view_count = youtube_view_count,
  entry_youtube_like_count = youtube_like_count
WHERE
  entry_youtube_view_count IS NULL
  AND youtube_view_count IS NOT NULL;

CREATE OR REPLACE FUNCTION calculate_vibe_index(p_claim_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_claim claims%ROWTYPE;
  v_view_growth numeric;
  v_like_growth numeric;
  v_follower_growth numeric;
  v_result numeric;
BEGIN
  SELECT * INTO v_claim FROM claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_claim.entry_youtube_view_count IS NOT NULL
     AND v_claim.entry_youtube_view_count > 0
     AND v_claim.youtube_view_count IS NOT NULL
  THEN
    v_view_growth := (v_claim.youtube_view_count::numeric - v_claim.entry_youtube_view_count::numeric)
                     / v_claim.entry_youtube_view_count::numeric * 100;
  ELSE
    v_view_growth := NULL;
  END IF;

  IF v_claim.entry_youtube_like_count IS NOT NULL
     AND v_claim.entry_youtube_like_count > 0
     AND v_claim.youtube_like_count IS NOT NULL
  THEN
    v_like_growth := (v_claim.youtube_like_count::numeric - v_claim.entry_youtube_like_count::numeric)
                     / v_claim.entry_youtube_like_count::numeric * 100;
  ELSE
    v_like_growth := NULL;
  END IF;

  IF v_view_growth IS NOT NULL AND v_like_growth IS NOT NULL THEN
    v_result := v_view_growth * 0.6 + v_like_growth * 0.4;
  ELSIF v_view_growth IS NOT NULL THEN
    v_result := v_view_growth;
  ELSIF v_like_growth IS NOT NULL THEN
    v_result := v_like_growth;
  ELSE
    IF v_claim.entry_followers > 0 THEN
      v_follower_growth := (v_claim.current_followers::numeric - v_claim.entry_followers::numeric)
                           / v_claim.entry_followers::numeric * 100;
      v_result := v_follower_growth;
    ELSE
      v_result := 0;
    END IF;
  END IF;

  RETURN ROUND(v_result, 1);
END;
$$;

CREATE OR REPLACE FUNCTION recalculate_all_vibe_indexes()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM claims LOOP
    UPDATE claims
    SET vibe_index = calculate_vibe_index(v_id),
        updated_at = now()
    WHERE id = v_id;
  END LOOP;
END;
$$;

SELECT recalculate_all_vibe_indexes();
