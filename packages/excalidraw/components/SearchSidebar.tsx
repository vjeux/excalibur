import { SEARCH_SIDEBAR } from "../constants";
import { SearchMenu } from "./SearchMenu";
import { Sidebar } from "./Sidebar/Sidebar";

export const SearchSidebar = () => {
  return (
    <Sidebar name={SEARCH_SIDEBAR.name} docked>
      <Sidebar.Tabs>
        <Sidebar.Header>
          <div
            style={{
              color: "var(--color-primary)",
              fontSize: "1.2em",
              fontWeight: "bold",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              paddingRight: "1em",
            }}
          >
            Find text
          </div>
        </Sidebar.Header>
        <SearchMenu />
      </Sidebar.Tabs>
    </Sidebar>
  );
};
