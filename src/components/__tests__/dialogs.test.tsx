import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFormDialog } from "@/components/dialogs/CategoryFormDialog";
import { ColumnFormDialog } from "@/components/dialogs/ColumnFormDialog";
import { ItemFormDialog } from "@/components/dialogs/ItemFormDialog";

const user = userEvent.setup();

describe("CategoryFormDialog", () => {
  type Props = Parameters<typeof CategoryFormDialog>[0];
  function setup(overrides: Partial<Props> = {}) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <CategoryFormDialog
        open
        onOpenChange={onOpenChange}
        title="Tạo đầu mục"
        onSubmit={onSubmit}
        {...overrides}
      />,
    );
    return { onSubmit, onOpenChange };
  }

  it("hiển thị tiêu đề và các trường name + description", () => {
    setup();
    expect(screen.getByText("Tạo đầu mục")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên")).toBeInTheDocument();
    expect(screen.getByLabelText("Mô tả")).toBeInTheDocument();
  });

  it("prefill khi sửa (initialName/initialDescription)", () => {
    setup({
      title: "Sửa đầu mục",
      initialName: "Triển khai văn bản",
      initialDescription: "Mô tả cũ",
    });
    expect(screen.getByLabelText("Tên")).toHaveValue("Triển khai văn bản");
    expect(screen.getByLabelText("Mô tả")).toHaveValue("Mô tả cũ");
  });

  it("name rỗng → lỗi inline, không gọi onSubmit, không đóng dialog", async () => {
    const { onSubmit, onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(
      await screen.findByText("Tên đầu mục là bắt buộc"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("name chỉ khoảng trắng → cũng bị chặn", async () => {
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText("Tên"), "   ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Tên đầu mục là bắt buộc")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit hợp lệ → gọi onSubmit với giá trị đã trim và đóng dialog", async () => {
    const { onSubmit, onOpenChange } = setup();
    await user.type(screen.getByLabelText("Tên"), "  Nhiệm vụ A  ");
    await user.type(screen.getByLabelText("Mô tả"), "  Mô tả B  ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Nhiệm vụ A", "Mô tả B"),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("onSubmit reject → hiển thị lỗi từ backend, dialog không đóng", async () => {
    const onSubmit = vi.fn().mockRejectedValue("Tên đã tồn tại");
    const onOpenChange = vi.fn();
    render(
      <CategoryFormDialog
        open
        onOpenChange={onOpenChange}
        title="Tạo đầu mục"
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText("Tên"), "Nhiệm vụ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText(/Tên đã tồn tại/)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("nút Hủy → onOpenChange(false), không gọi onSubmit", async () => {
    const { onSubmit, onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("đang lưu → nút Lưu disabled với nhãn 'Đang lưu…'", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(
      () => new Promise<void>((r) => (resolve = r)),
    );
    render(
      <CategoryFormDialog
        open
        onOpenChange={vi.fn()}
        title="Tạo đầu mục"
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText("Tên"), "Nhiệm vụ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Đang lưu…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
    resolve();
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument(),
    );
  });
});

describe("ColumnFormDialog", () => {
  type Props = Parameters<typeof ColumnFormDialog>[0];
  function setup(overrides: Partial<Props> = {}) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ColumnFormDialog
        open
        onOpenChange={onOpenChange}
        title="Thêm cột global"
        onSubmit={onSubmit}
        {...overrides}
      />,
    );
    return { onSubmit, onOpenChange };
  }

  it("name rỗng → lỗi 'Tên cột là bắt buộc'", async () => {
    const { onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(
      await screen.findByText("Tên cột là bắt buộc"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("name có, code rỗng → lỗi 'Code là bắt buộc'", async () => {
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText("Tên"), "Kiểm thử");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Code là bắt buộc")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("code sai charset (dấu cách, tiếng Việt) → lỗi inline, không gọi API", async () => {
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText("Tên"), "Kiểm thử");
    await user.type(screen.getByLabelText("Code"), "code không hợp lệ!");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(
      await screen.findByText("Code chỉ gồm a-z, A-Z, 0-9, _ và -"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("code hợp lệ (a-z, 0-9, _, -) → submit với giá trị trim", async () => {
    const { onSubmit, onOpenChange } = setup();
    await user.type(screen.getByLabelText("Tên"), "  Kiểm thử  ");
    await user.type(screen.getByLabelText("Code"), "  test_col-01  ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Kiểm thử", "test_col-01"),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("prefill khi sửa cột", () => {
    setup({ title: "Sửa cột global", initialName: "Đang chạy", initialCode: "running" });
    expect(screen.getByLabelText("Tên")).toHaveValue("Đang chạy");
    expect(screen.getByLabelText("Code")).toHaveValue("running");
  });
});

describe("ItemFormDialog", () => {
  type Props = Parameters<typeof ItemFormDialog>[0];
  function setup(overrides: Partial<Props> = {}) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ItemFormDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        {...overrides}
      />,
    );
    return { onSubmit, onOpenChange };
  }

  it("name rỗng → lỗi 'Tên item là bắt buộc'", async () => {
    const { onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(
      await screen.findByText("Tên item là bắt buộc"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit hợp lệ → name + description trim, đóng dialog", async () => {
    const { onSubmit, onOpenChange } = setup({
      initialName: "Việc cũ",
      initialDescription: "desc cũ",
    });
    await user.clear(screen.getByLabelText("Tên"));
    await user.type(screen.getByLabelText("Tên"), "Việc mới");
    await user.clear(screen.getByLabelText("Mô tả"));
    await user.type(screen.getByLabelText("Mô tả"), "  mô tả mới  ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Việc mới", "mô tả mới"),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("onSubmit reject → giữ dialog mở và hiện lỗi", async () => {
    const onSubmit = vi.fn().mockRejectedValue("Lỗi DB");
    const onOpenChange = vi.fn();
    render(
      <ItemFormDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText("Tên"), "Việc");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText(/Lỗi DB/)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
