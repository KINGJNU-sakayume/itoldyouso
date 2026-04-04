/*
  # Add YouTube fields to claims table

  ## Summary
  Spotify로 선택된 곡에 연결되는 YouTube 동영상 정보를 저장하기 위해
  claims 테이블에 4개의 컬럼을 추가합니다.

  ## Changes

  ### Modified Tables
  - `claims`
    - `youtube_video_id` (text, nullable): 사용자가 선택한 YouTube 동영상 ID
    - `youtube_video_title` (text, nullable): YouTube 동영상 제목
    - `youtube_view_count` (bigint, nullable): 클레임 등록 시점의 조회수
    - `youtube_like_count` (bigint, nullable): 클레임 등록 시점의 좋아요 수

  ## Notes
  - 모든 컬럼은 nullable (YouTube 연동은 선택 사항)
  - 기존 데이터는 영향 없음
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'youtube_video_id'
  ) THEN
    ALTER TABLE claims ADD COLUMN youtube_video_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'youtube_video_title'
  ) THEN
    ALTER TABLE claims ADD COLUMN youtube_video_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'youtube_view_count'
  ) THEN
    ALTER TABLE claims ADD COLUMN youtube_view_count bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'youtube_like_count'
  ) THEN
    ALTER TABLE claims ADD COLUMN youtube_like_count bigint;
  END IF;
END $$;
