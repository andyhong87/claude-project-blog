"use client";

import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  CATEGORIES,
  type Category,
  type PublishResult,
  type PublishStage,
} from "@/lib/publishing/types";

const STAGE_LABEL: Record<PublishStage, string> = {
  login: "로그인",
  compose: "글 작성",
  publish: "발행",
};

type State =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; result: PublishResult }
  | { status: "unreachable" }
  | { status: "serverError"; httpStatus: number }
  | { status: "missing" };

export function PublishForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [state, setState] = useState<State>({ status: "idle" });

  const pending = state.status === "pending";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!username.trim() || !password) {
      setState({ status: "missing" });
      return;
    }
    setState({ status: "pending" });

    let response: Response;
    try {
      response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, category }),
      });
    } catch {
      setState({ status: "unreachable" });
      return;
    }
    try {
      setState({ status: "done", result: await response.json() });
    } catch {
      // 서버가 결과 대신 오류 페이지를 돌려준 경우(예: 500)는 연결 실패와 구분한다.
      setState({ status: "serverError", httpStatus: response.status });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>티스토리 글 발행</CardTitle>
        <CardDescription>
          분야의 최신 뉴스를 바탕으로 글 1편을 써서 내 블로그에 발행합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">티스토리 아이디</FieldLabel>
              <Input
                id="username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">비밀번호</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="category">분야</FieldLabel>
              <NativeSelect
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value as Category)}
                disabled={pending}
              >
                {CATEGORIES.map((name) => (
                  <NativeSelectOption key={name} value={name}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  발행 중… (몇 분 걸릴 수 있습니다)
                </>
              ) : (
                "지금 발행"
              )}
            </Button>
            {pending && (
              <FieldDescription>
                로그인 중에 캡차가 나오면 새로 열린 브라우저 창에서 직접 풀어 주세요.
              </FieldDescription>
            )}
            <Result state={state} />
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function Result({ state }: { state: State }) {
  if (state.status === "missing") {
    return (
      <Alert variant="destructive">
        <AlertTitle>발행하지 못했습니다</AlertTitle>
        <AlertDescription>티스토리 아이디와 비밀번호를 입력하세요.</AlertDescription>
      </Alert>
    );
  }
  if (state.status === "serverError") {
    return (
      <Alert variant="destructive">
        <AlertTitle>발행하지 못했습니다</AlertTitle>
        <AlertDescription>
          서버에서 오류가 났습니다 ({state.httpStatus}). 잠시 후 다시 시도하세요.
        </AlertDescription>
      </Alert>
    );
  }
  if (state.status === "unreachable") {
    return (
      <Alert variant="destructive">
        <AlertTitle>발행하지 못했습니다</AlertTitle>
        <AlertDescription>서버에 연결하지 못했습니다.</AlertDescription>
      </Alert>
    );
  }
  if (state.status !== "done") return null;

  const { result } = state;
  if (result.ok) {
    return (
      <Alert>
        <AlertTitle>발행했습니다</AlertTitle>
        <AlertDescription>
          <a
            className="font-medium underline underline-offset-4"
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            발행된 글 보기
          </a>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>발행하지 못했습니다</AlertTitle>
      <AlertDescription>
        {STAGE_LABEL[result.stage]} 단계에서 실패했습니다. {result.message}
      </AlertDescription>
    </Alert>
  );
}
