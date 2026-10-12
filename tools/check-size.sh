#!/bin/sh
# 커밋 직전 검사: 5MB를 넘는 파일이 올라가려 하면 막는다. (설치: sh tools/check-size.sh --install)
if [ "$1" = "--install" ]; then
  printf '#!/bin/sh\nexec sh tools/check-size.sh\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit && echo "pre-commit 훅 설치됨"; exit 0
fi
LIMIT=5242880; bad=0
for f in $(git diff --cached --name-only --diff-filter=AM); do
  [ -f "$f" ] || continue
  s=$(wc -c < "$f")
  if [ "$s" -gt "$LIMIT" ]; then echo "커밋 중단: $f ($((s/1048576))MB) 가 5MB를 넘습니다. 영상·큰 파일은 깃에 올리지 마세요."; bad=1; fi
done
exit $bad
