import React from "react";

import { LoadingMessage } from "./LoadingMessage";
import {
  defaultLang,
  Language,
  languages,
  setLanguageFirstTime,
} from "../i18n";

interface Props {
  langCode: Language["code"];
  onLangChange?: (lang: Language) => void;
}
interface State {
  isLoading: boolean;
}
export class InitializeApp extends React.Component<Props, State> {
  public state: { isLoading: boolean } = {
    isLoading: true,
  };

  async componentDidMount() {
    const currentLanguage =
      languages.find((lang) => lang.code === this.props.langCode) ||
      defaultLang;
    await setLanguageFirstTime(currentLanguage);
    this.props.onLangChange?.(currentLanguage);
    this.setState({
      isLoading: false,
    });
  }

  public render() {
    return this.state.isLoading ? <LoadingMessage /> : this.props.children;
  }
}
