FROM ubuntu:latest
LABEL authors="Owner"

CMD uvicorn main:app --host 0.0.0.0 --port 8000
CMD celery -A services.tasks worker --loglevel=info


ENTRYPOINT ["top", "-b"]