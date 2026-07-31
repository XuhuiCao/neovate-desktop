import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import type { DevMode } from "../draft-store";

import { APP_NAME } from "../../../../../shared/constants";
import { getLogoUrl, IMAGE_URLS } from "../../../assets/images";

type WelcomePanelProps = {
  devMode?: DevMode;
  projectName?: string;
  isPlayground?: boolean;
};

export function WelcomePanel({ devMode = "free", projectName, isPlayground }: WelcomePanelProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();

  // 研发流程模式使用专门的欢迎图，自由研发模式保持原有的 logo
  const imageUrl =
    devMode === "standard"
      ? IMAGE_URLS.workflowWelcome
      : getLogoUrl(resolvedTheme as "dark" | "light" | undefined);

  // 根据项目和模式生成欢迎语
  const renderWelcomeText = () => {
    // Playground 专用文案
    if (isPlayground) {
      return (
        <p className="text-lg text-center font-medium text-foreground/90">
          {t("chat.guideMessage.playground", { APP_NAME })}
        </p>
      );
    }

    if (devMode === "standard") {
      return (
        <p className="text-lg text-center font-medium text-foreground/90">
          {projectName
            ? t("chat.guideMessage.standard.projectHint", { projectName })
            : t("chat.guideMessage.standard.hint")}
        </p>
      );
    }

    return (
      <p className="text-lg text-center font-medium text-foreground/90">
        {projectName
          ? t("chat.guideMessage.free.projectHint", { projectName })
          : t("chat.guideMessage.free.hint")}
      </p>
    );
  };

  return (
    <div className="flex flex-col items-center gap-5 text-muted-foreground">
      <img
        src={imageUrl}
        className="h-24 w-auto object-contain 2xl:h-36 min-[1920px]:h-48"
        alt={`${APP_NAME} Logo`}
      />
      {renderWelcomeText()}
    </div>
  );
}
