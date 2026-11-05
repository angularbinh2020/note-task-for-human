import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAddInput } from "@/components/QuickAddInput";

describe("QuickAddInput", () => {
  it("hiển thị placeholder 'Thêm item…'", () => {
    render(<QuickAddInput onAdd={vi.fn()} />);
    expect(screen.getByPlaceholderText("Thêm item…")).toBeInTheDocument();
  });

  it("Enter với name hợp lệ → gọi onAdd với giá trị đã trim và clear input", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddInput onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Thêm item…");
    await user.type(input, "  Soạn tờ trình  ");
    await user.type(input, "{enter}");

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("Soạn tờ trình");
    await vi.waitFor(() => expect(input).toHaveValue(""));
  });

  it("Enter với input rỗng → không gọi onAdd, không clear", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddInput onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Thêm item…");
    await user.type(input, "{enter}");

    expect(onAdd).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("Enter với chỉ khoảng trắng → không gọi onAdd (trim rỗng)", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddInput onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Thêm item…");
    await user.type(input, "   ");
    await user.type(input, "{enter}");

    expect(onAdd).not.toHaveBeenCalled();
    expect(input.className).toContain("shake");
  });

  it("phím khác Enter không submit", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddInput onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Thêm item…");
    await user.type(input, "abc");

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("trong lúc onAdd đang chạy → input disabled; xong → clear và enable lại", async () => {
    let resolveAdd: () => void = () => {};
    const onAdd = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<QuickAddInput onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Thêm item…") as HTMLInputElement;
    await user.type(input, "Việc A");
    await user.type(input, "{enter}");

    expect(onAdd).toHaveBeenCalledWith("Việc A");
    expect(input).toBeDisabled();

    resolveAdd();
    await vi.waitFor(() => expect(input).not.toBeDisabled());
    expect(input.value).toBe("");
  });

  it("onAdd ném lỗi → vẫn enable lại input", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("DB lỗi"));
    const user = userEvent.setup();
    render(<QuickAddInput onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Thêm item…") as HTMLInputElement;
    await user.type(input, "Việc B");
    await user.type(input, "{enter}");

    await vi.waitFor(() => expect(input).not.toBeDisabled());
  });
});
