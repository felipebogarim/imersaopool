import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmailContactsManager } from "./EmailContactsManager";
import { TemplateManager } from "./TemplateManager";
import { Mail, Users } from "lucide-react";

export function EmailsAtualizacoes() {
  const [activeTab, setActiveTab] = useState("templates");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contatos
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>
          
          <TabsContent value="contacts">
            <EmailContactsManager />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
