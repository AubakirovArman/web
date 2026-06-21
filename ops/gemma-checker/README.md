# Снимок gemma-checker (микросервис проверки документов, :8052)

Боевой файл: `/mnt/models/NDDA_AI/8040/services/gemma-checker/main.py` (вне git).
Здесь — версионируемый снимок, чтобы изменения промпта фиксировались вместе с правками проверок.

## Что важного в промпте (build_prompt)
- Условные требования («Если…/При наличии…/Для … препаратов») при невыполнении условия → not_applicable, не failed.
- Сверки со смежным разделом при отсутствии его текста → uncertain «нужен смежный раздел», не failed.
- Каскад отсутствующего документа (нет CPP/РУ) → зависимые сверки uncertain, не дублировать как несколько failed.
- generic/фармакопея с допустимой ссылкой (CEP/монография/референт) → выполнено.

## Деплой
    cp ops/gemma-checker/main.py /mnt/models/NDDA_AI/8040/services/gemma-checker/main.py
    pkill -f "uvicorn main:app .* --port 8052"
    cd /mnt/models/NDDA_AI/8040/services/gemma-checker && \
      setsid nohup python -m uvicorn main:app --host 127.0.0.1 --port 8052 > /tmp/gemma8052.log 2>&1 < /dev/null &
